"""Agent 1 (conversational mode): multi-turn intake dialogue.

The assistant checks which facts are still missing (what happened, where, since when), asks one
follow-up question per turn in the citizen's language, and hands over to structured draft generation
once it has enough, or after the citizen chooses to continue. The citizen still reviews and confirms
the draft before anything is filed.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.agents.intake import classify_rules, detect_language, extract_location
from app.models import GrievanceCategory
from app.services import geo

MAX_QUESTIONS = 3
DURATION_RE = re.compile(
    r"(\d+\s*(day|days|week|weeks|month|months|hour|hours|दिन|दिनों|हफ्ते|महीने|घंटे|दिवस|दिवसांपासून|आठवडा|आठवड्यांपासून|महिन्यांपासून|तास))"
    r"|since|yesterday|today|morning|last night|कल से|आज|परवा|कालपासून|आजपासून|सकाळपासून|से\s",
    re.IGNORECASE,
)
SKIP_RE = re.compile(r"^\s*(skip|no|don'?t know|not sure|submit|continue|नहीं|पता नहीं|छोड़ें|नाही|माहीत नाही|पुढे)\s*[.!]?\s*$", re.IGNORECASE)

QUESTIONS: dict[str, dict[str, str]] = {
    "details": {
        "en": "Could you describe the problem in a little more detail? What is happening and who is affected?",
        "hi": "कृपया समस्या थोड़ा विस्तार से बताएं। क्या हो रहा है और कौन प्रभावित है?",
        "mr": "कृपया समस्या थोडी सविस्तर सांगा. काय होत आहे आणि कोण बाधित आहे?",
    },
    "location": {
        "en": "Where exactly is this? Please share the area, ward or a nearby landmark.",
        "hi": "यह समस्या ठीक कहाँ है? कृपया इलाका, वार्ड या पास का कोई पहचान चिह्न बताएं।",
        "mr": "ही समस्या नेमकी कुठे आहे? कृपया परिसर, प्रभाग किंवा जवळची खूण सांगा.",
    },
    "duration": {
        "en": "Since when has this been happening? Is anyone at immediate risk?",
        "hi": "यह कब से हो रहा है? क्या किसी को तुरंत खतरा है?",
        "mr": "हे कधीपासून होत आहे? कोणाला तात्काळ धोका आहे का?",
    },
}
READY = {
    "en": "Thank you. I have prepared a draft from what you told me. Please check it before submitting.",
    "hi": "धन्यवाद। आपकी बातों से मैंने एक मसौदा तैयार किया है। कृपया जमा करने से पहले इसे जाँच लें।",
    "mr": "धन्यवाद. तुम्ही सांगितलेल्या माहितीवरून मी मसुदा तयार केला आहे. सबमिट करण्यापूर्वी कृपया तो तपासा.",
}


@dataclass
class TurnResult:
    reply: str
    ready: bool
    language: str
    slots: dict[str, Any]
    missing: list[str]
    reasoning: list[str] = field(default_factory=list)


def assess(db: Session, messages: list[dict[str, str]], language_hint: str | None, finish: bool = False) -> TurnResult:
    user_turns = [m["content"].strip() for m in messages if m.get("role") == "user" and m.get("content", "").strip()]
    text = " ".join(user_turns)
    asked = sum(1 for m in messages if m.get("role") == "assistant")
    lang = detect_language(text, language_hint)

    cats = list(db.scalars(select(GrievanceCategory).where(GrievanceCategory.is_active.is_(True))))
    code, conf, _ = classify_rules(text, cats) if text else ("GENERAL", 0.0, [])
    loc_text, ward = extract_location(text, geo.gazetteer())
    has_location = bool(loc_text) or bool(re.search(r"(near|road|street|nagar|colony|chowk|ward|गली|रोड|नगर|चौक|प्रभाग|वार्ड|जवळ|के पास)", text, re.I))
    slots = {
        "details": len(text) >= 40 and not (code == "GENERAL" and conf < 0.4 and len(text) < 80),
        "location": has_location,
        "duration": bool(DURATION_RE.search(text)),
    }
    missing = [k for k in ("details", "location", "duration") if not slots[k]]
    last = user_turns[-1] if user_turns else ""
    reasoning = [
        f"Language: {lang}; turns so far: {len(user_turns)} citizen, {asked} assistant",
        f"Provisional category {code} ({conf:.2f}); location: {loc_text or ('mentioned' if has_location else 'missing')}",
        "Missing facts: " + (", ".join(missing) or "none"),
    ]
    wants_to_continue = bool(SKIP_RE.match(last)) and asked > 0
    if finish and len(text) >= 10:
        reasoning.append("Citizen asked for the draft now")
    if (finish and len(text) >= 10) or not missing or asked >= MAX_QUESTIONS or wants_to_continue or (not slots["details"] and asked >= 2 and len(text) >= 10):
        reasoning.append("Enough information (or citizen chose to continue): generating structured draft")
        return TurnResult(READY[lang], True, lang, {**slots, "ward": ward, "category_hint": code}, missing, reasoning)
    nxt = missing[0]
    reasoning.append(f"Asking about: {nxt}")
    return TurnResult(QUESTIONS[nxt][lang], False, lang, {**slots, "ward": ward, "category_hint": code}, missing, reasoning)
