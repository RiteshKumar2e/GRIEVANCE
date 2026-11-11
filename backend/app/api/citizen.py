"""Citizen portal API: intake (text/voice), confirmation, tracking, resolution feedback, disputes."""
from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.agents import orchestrator
from app.api.access import get_grievance_for
from app.api.serializers import grievance_detail, grievance_summary
from app.core.config import get_settings
from app.core.deps import get_current_user, require_citizen
from app.core.errors import DomainError, InvalidTransition
from app.core.ratelimit import limiter
from app.core.time import as_aware, utcnow
from app.db.session import get_db
from app.llm import stt
from app.models import Grievance, IntakeDraft, Notification, User
from app.models.enums import ActorType, GrievanceStatus
from app.schemas.api import ConfirmIn, ConverseIn, ConverseOut, DisputeIn, DraftOut, FeedbackIn, IntakeIn, TranscriptOut
from app.services import audit, notifications
from app.services.grievances import transition
from app.services.webhooks import grievance_payload, queue_event

router = APIRouter(prefix="/citizen", tags=["citizen"])
ALLOWED_AUDIO = {"audio/webm", "audio/ogg", "audio/wav", "audio/x-wav", "audio/mpeg", "audio/mp4", "audio/m4a", "audio/x-m4a",
                 "video/webm", "application/octet-stream"}


def _draft_out(d: IntakeDraft) -> DraftOut:
    return DraftOut(draft_token=d.token, expires_at=as_aware(d.expires_at), trace_id=d.trace_id, raw_text=d.raw_text,
                    extraction=d.extraction)


@router.post("/intake/analyze", response_model=DraftOut)
def analyze(body: IntakeIn, request: Request, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    """Agent 1: structured extraction. Returns a DRAFT for review — nothing is submitted yet."""
    limiter.check(request, "intake", limit=30, window=600, key=str(user.id))
    draft = orchestrator.analyze_intake(db, user, body.text.strip(), language_hint=body.language,
                                        location_hint=body.location, input_mode=body.input_mode)
    return _draft_out(draft)


@router.post("/intake/converse", response_model=ConverseOut)
def converse(body: ConverseIn, request: Request, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    """Conversational intake: asks follow-up questions in the citizen's language, then generates the
    structured draft. Nothing is submitted until the citizen confirms the draft."""
    from app.agents import conversation
    from app.services.tracing import Tracer

    limiter.check(request, "converse", limit=120, window=600, key=str(user.id))
    msgs = [m.model_dump() for m in body.messages]
    turn = conversation.assess(db, msgs, body.language, finish=body.finish)
    tracer = Tracer(db, "intake_conversation", metadata={"turn": sum(1 for m in msgs if m["role"] == "user")})
    with tracer.step("intake_dialogue", {"turns": len(msgs), "language_hint": body.language}) as run:
        run.provider, run.model, run.confidence = "dialogue-manager", "slot-filling-v1", None
        run.output = {"ready": turn.ready, "missing": turn.missing, "language": turn.language, "reasoning": turn.reasoning}
    tracer.finish()
    db.commit()
    if not turn.ready:
        return ConverseOut(reply=turn.reply, ready=False, language=turn.language, missing=turn.missing, trace_id=tracer.trace_id)
    text = "\n".join(m["content"].strip() for m in msgs if m["role"] == "user")[:5000]
    draft = orchestrator.analyze_intake(db, user, text, language_hint=body.language or turn.language, input_mode=body.input_mode)
    return ConverseOut(reply=turn.reply, ready=True, language=turn.language, missing=turn.missing, trace_id=draft.trace_id,
                       draft=_draft_out(draft))


@router.post("/intake/transcribe", response_model=TranscriptOut)
async def transcribe(request: Request, audio: UploadFile = File(...), language: str | None = Form(default=None),
                     user: User = Depends(require_citizen)):
    """Whisper speech-to-text. The transcript is returned for the citizen to edit, then analysed."""
    limiter.check(request, "stt", limit=20, window=600, key=str(user.id))
    if (audio.content_type or "").split(";")[0] not in ALLOWED_AUDIO:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unsupported audio format")
    data = await audio.read()
    if len(data) > get_settings().max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Audio file too large")
    if len(data) < 1000:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Recording is empty or too short")
    fd, path = tempfile.mkstemp(suffix=os.path.splitext(audio.filename or "a.webm")[1] or ".webm")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(data)
        try:
            t = stt.transcribe(path, language_hint=language)
        except stt.STTUnavailable as exc:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, str(exc))
    finally:
        try:
            os.remove(path)  # audio is never stored
        except OSError:
            pass
    if not t.text:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "No speech detected. Please try again or type your complaint.")
    return TranscriptOut(text=t.text, language=t.language, confidence=t.confidence, provider=t.provider)


@router.get("/intake/{token}", response_model=DraftOut)
def get_draft(token: str, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    d = db.scalar(select(IntakeDraft).where(IntakeDraft.token == token, IntakeDraft.citizen_id == user.id))
    if d is None:
        raise HTTPException(404, "Draft not found")
    return _draft_out(d)


@router.post("/intake/{token}/confirm", status_code=201)
def confirm(token: str, body: ConfirmIn, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    """Citizen confirmation: creates the grievance and runs the agent pipeline."""
    g = orchestrator.confirm_draft(db, user, token, body.model_dump())
    return grievance_detail(db, g, user)


@router.post("/intake/{token}/discard", status_code=204)
def discard(token: str, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    d = db.scalar(select(IntakeDraft).where(IntakeDraft.token == token, IntakeDraft.citizen_id == user.id))
    if d is None:
        raise HTTPException(404, "Draft not found")
    if d.status == "pending":
        d.status = "discarded"
        db.commit()


@router.get("/grievances")
def my_grievances(status_filter: str | None = Query(default=None, alias="status"), user: User = Depends(require_citizen),
                  db: Session = Depends(get_db)):
    q = select(Grievance).where(Grievance.citizen_id == user.id).order_by(Grievance.created_at.desc())
    if status_filter:
        q = q.where(Grievance.status == status_filter)
    return [grievance_summary(g, user) for g in db.scalars(q)]


@router.get("/grievances/{public_id}")
def track(public_id: str, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    return grievance_detail(db, get_grievance_for(db, user, public_id), user)


@router.post("/grievances/{public_id}/confirm-resolution")
def confirm_resolution(public_id: str, body: FeedbackIn, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    g = get_grievance_for(db, user, public_id)
    if g.status != GrievanceStatus.RESOLVED.value:
        raise InvalidTransition("Only a resolved grievance can be confirmed.")
    g.citizen_rating, g.citizen_feedback = body.rating, body.comment
    transition(db, g, GrievanceStatus.CLOSED, actor=f"user:{user.id}", actor_type=ActorType.CITIZEN.value,
               note="Citizen confirmed the resolution.")
    notifications.notify_officer(db, g, "closed", f"{g.public_id} closed by citizen",
                                 f"The citizen confirmed the resolution{f' (rating {body.rating}/5)' if body.rating else ''}.",
                                 created_by=f"user:{user.id}")
    db.commit()
    return grievance_detail(db, g, user)


@router.post("/grievances/{public_id}/dispute")
def dispute(public_id: str, body: DisputeIn, user: User = Depends(require_citizen), db: Session = Depends(get_db)):
    """Dispute a resolution: reopens the grievance, notifies the officer and escalates repeat disputes."""
    g = get_grievance_for(db, user, public_id)
    if g.status not in (GrievanceStatus.RESOLVED.value, GrievanceStatus.CLOSED.value):
        raise InvalidTransition("Only a resolved or closed grievance can be disputed.")
    if g.status == GrievanceStatus.CLOSED.value and g.closed_at and (utcnow() - as_aware(g.closed_at)).days > 30:
        raise DomainError("The dispute window (30 days after closure) has passed. Please file a new grievance.")
    transition(db, g, GrievanceStatus.REOPENED, actor=f"user:{user.id}", actor_type=ActorType.CITIZEN.value,
               note=f"Citizen disputed the resolution: {body.reason}")
    g.citizen_feedback = body.reason
    audit.record(db, action="grievance.disputed", actor=f"user:{user.id}", actor_type=ActorType.CITIZEN.value, grievance=g,
                 explanation={"reopen_count": g.reopen_count})
    notifications.notify_officer(db, g, "reopened", f"Resolution disputed: {g.public_id}",
                                 "The citizen disputed the resolution and the grievance has been reopened.", created_by=f"user:{user.id}")
    queue_event(db, "grievance.reopened", grievance_payload(g))
    if g.reopen_count >= 2:
        from app.agents.actions import escalate

        escalate(db, g, reason=f"Resolution disputed {g.reopen_count} times.", trace_id=None,
                 provider="deterministic-rules", model="dispute-rule-v1")
    db.commit()
    return grievance_detail(db, g, user)


# ---------------------------------------------------------------- notifications (any role)
notif_router = APIRouter(prefix="/notifications", tags=["notifications"])


@notif_router.get("")
def list_notifications(unread: bool = False, limit: int = Query(default=50, le=200), user: User = Depends(get_current_user),
                       db: Session = Depends(get_db)):
    q = select(Notification).where(Notification.user_id == user.id)
    if unread:
        q = q.where(Notification.is_read.is_(False))
    rows = db.scalars(q.order_by(Notification.created_at.desc(), Notification.id.desc()).limit(limit)).all()
    unread_count = db.scalar(select(func.count()).select_from(Notification).where(
        Notification.user_id == user.id, Notification.is_read.is_(False)))
    return {"unread": unread_count, "items": [
        {"id": n.id, "kind": n.kind, "title": n.title, "body": n.body, "is_read": n.is_read, "channel": n.channel,
         "grievance_id": n.grievance.public_id if n.grievance else None, "created_at": as_aware(n.created_at).isoformat()}
        for n in rows]}


@notif_router.post("/{nid}/read", status_code=204)
def mark_read(nid: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    n = db.get(Notification, nid)
    if n is None or n.user_id != user.id:
        raise HTTPException(404, "Notification not found")
    n.is_read = True
    db.commit()


@notif_router.post("/read-all", status_code=204)
def mark_all_read(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    for n in db.scalars(select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False))):
        n.is_read = True
    db.commit()
