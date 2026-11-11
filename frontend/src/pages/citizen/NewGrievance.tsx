import { useQuery } from "@tanstack/react-query";
import { Bot, Mic, MicOff, PencilLine, ShieldAlert, Sparkles } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSystemStatus } from "../../components/AppShell";
import { ConfidenceMeter, UrgencyBadge } from "../../components/domain";
import { Alert, Badge, Button, Card, Field, Input, PageHeader, Select, Textarea } from "../../components/ui";
import { api, ApiError } from "../../lib/api";
import { URGENCY_ORDER } from "../../lib/format";
import { categoryName, LANG_LABEL, useI18n } from "../../lib/i18n";
import type { CategoryMeta, Draft, GrievanceDetail, Urgency } from "../../lib/types";

type Step = "compose" | "review";

function useRecorder(onDone: (blob: Blob) => void) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const supported = typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        onDone(new Blob(chunks.current, { type: mr.mimeType || "audio/webm" }));
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
    } catch {
      setError("Microphone access was denied or is unavailable.");
    }
  };
  const stop = () => {
    rec.current?.stop();
    setRecording(false);
  };
  return { supported, recording, error, start, stop };
}

export default function NewGrievance() {
  const { t, lang } = useI18n();
  const nav = useNavigate();
  const status = useSystemStatus();
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories") });
  const wards = useQuery({ queryKey: ["meta", "wards"], queryFn: () => api<{ ward: string; locality: string }[]>("/meta/wards") });

  const [step, setStep] = useState<Step>("compose");
  const [text, setText] = useState("");
  const [location, setLocation] = useState("");
  const [inputMode, setInputMode] = useState<"text" | "voice">("text");
  const [busy, setBusy] = useState<null | "analyze" | "transcribe" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edits, setEdits] = useState({ title: "", category_code: "", location_text: "", ward: "", urgency: "medium" as Urgency });
  const [consent, setConsent] = useState(false);

  const recorder = useRecorder(async (blob) => {
    setBusy("transcribe");
    setError(null);
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("language", lang);
    try {
      const r = await api<{ text: string; language: string }>("/citizen/intake/transcribe", { form });
      setText((prev) => (prev ? `${prev} ${r.text}` : r.text));
      setInputMode("voice");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setBusy(null);
    }
  });

  useEffect(() => {
    if (!draft) return;
    const ex = draft.extraction;
    setEdits({ title: ex.title, category_code: ex.category_code, location_text: ex.location_text ?? "", ward: ex.ward ?? "", urgency: ex.urgency });
    setConsent(false);
  }, [draft]);

  const analyze = async () => {
    setBusy("analyze");
    setError(null);
    try {
      const d = await api<Draft>("/citizen/intake/analyze", { body: { text: text.trim(), language: undefined, location: location.trim() || undefined, input_mode: inputMode } });
      setDraft(d);
      setStep("review");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof ApiError && e.status === 422 ? "Please describe the problem in at least a sentence (10+ characters)." : e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setBusy(null);
    }
  };

  const submit = async () => {
    if (!draft) return;
    setBusy("submit");
    setError(null);
    try {
      const g = await api<GrievanceDetail>(`/citizen/intake/${draft.draft_token}/confirm`, {
        body: {
          confirmed: consent,
          title: edits.title.trim() || undefined,
          category_code: edits.category_code,
          location_text: edits.location_text.trim() || undefined,
          ward: edits.ward || undefined,
          urgency: edits.urgency,
        },
      });
      nav(`/citizen/grievances/${g.public_id}?new=1`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
      setBusy(null);
    }
  };

  const ex = draft?.extraction;
  const selectedCat = useMemo(() => cats.data?.find((c) => c.code === edits.category_code), [cats.data, edits.category_code]);
  const changedCategory = ex && edits.category_code !== ex.category_code;
  const minUrgency = ex ? URGENCY_ORDER.indexOf(ex.urgency) : 0;
  const sttAvailable = status.data?.speech_to_text.available;

  if (step === "review" && draft && ex) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title={t("reviewTitle")} subtitle={t("reviewHint")} />
        {error && <div className="mb-4"><Alert tone="critical">{error}</Alert></div>}
        <div className="space-y-5">
          <Card
            title={
              <span className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-brand-600" aria-hidden /> What the assistant understood
              </span>
            }
            action={
              <Badge tone={ex.method === "rules" ? "outline" : "brand"} title={ex.provider_attempts.map((a) => `${a.provider}: ${a.status}`).join(", ")}>
                {ex.method === "rules" ? "Rule-based (no LLM)" : `${ex.provider} · ${ex.model}`}
              </Badge>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Your description · {LANG_LABEL[ex.language]}</p>
                <p className="mt-1 whitespace-pre-wrap rounded-md bg-canvas p-3 text-sm" lang={ex.language}>
                  {draft.raw_text}
                </p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Summary for the officer</p>
                <p className="mt-1 text-sm text-ink">{ex.summary}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Classification confidence</p>
                <div className="mt-1.5">
                  <ConfidenceMeter value={ex.category_confidence} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">{t("department")}</p>
                <p className="mt-1 text-sm font-medium">{selectedCat?.department_code === ex.department?.code ? ex.department?.name : selectedCat?.department_code ?? "—"}</p>
              </div>
            </div>
          </Card>

          {(ex.policy_preview.is_sensitive || selectedCat?.is_sensitive) && (
            <Alert tone="warning" title="Sensitive matter">
              <span className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                {t("sensitiveNote")}
              </span>
            </Alert>
          )}
          {(ex.policy_preview.requires_human_review || changedCategory) && !ex.policy_preview.is_sensitive && <Alert tone="info">{t("reviewNote")}</Alert>}

          <Card title="Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("title")} htmlFor="title">
                  <Input id="title" value={edits.title} maxLength={300} onChange={(e) => setEdits((s) => ({ ...s, title: e.target.value }))} />
                </Field>
              </div>
              <Field label={t("category")} htmlFor="cat" hint={changedCategory ? "You changed the suggested category; an officer will verify it." : undefined}>
                <Select id="cat" value={edits.category_code} onChange={(e) => setEdits((s) => ({ ...s, category_code: e.target.value }))}>
                  {cats.data?.map((c) => (
                    <option key={c.code} value={c.code}>
                      {categoryName(c, lang)}
                      {c.code === ex.category_code ? " (suggested)" : ex.alternatives.some((a) => a.category_code === c.code) ? " (possible)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("urgency")} htmlFor="urg" hint="You can raise the urgency; the assistant's safety estimate is never lowered.">
                <Select id="urg" value={edits.urgency} onChange={(e) => setEdits((s) => ({ ...s, urgency: e.target.value as Urgency }))}>
                  {URGENCY_ORDER.map((u, i) => (
                    <option key={u} value={u} disabled={i < minUrgency}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Location" htmlFor="loc">
                <Input id="loc" value={edits.location_text} onChange={(e) => setEdits((s) => ({ ...s, location_text: e.target.value }))} placeholder="Street, landmark" />
              </Field>
              <Field label="Ward" htmlFor="ward">
                <Select id="ward" value={edits.ward} onChange={(e) => setEdits((s) => ({ ...s, ward: e.target.value }))}>
                  <option value="">Not sure</option>
                  {wards.data?.map((w) => (
                    <option key={w.ward} value={w.ward}>
                      {w.ward} · {w.locality}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
              <span>Current urgency:</span> <UrgencyBadge urgency={edits.urgency} />
              {selectedCat && <span className="ml-2">SLA target: {selectedCat.sla_hours} h</span>}
            </div>
          </Card>

          <div className="rounded-lg border border-line bg-white p-5">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line accent-brand-800" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span lang={lang}>{t("consent")}</span>
            </label>
            <div className="mt-4 flex flex-wrap justify-between gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  void api(`/citizen/intake/${draft.draft_token}/discard`, { method: "POST" }).catch(() => undefined);
                  setStep("compose");
                  setDraft(null);
                }}
              >
                <PencilLine className="h-4 w-4" aria-hidden /> {t("edit")}
              </Button>
              <Button variant="accent" onClick={submit} disabled={!consent || !edits.category_code} loading={busy === "submit"}>
                {t("confirmSubmit")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("fileComplaint")} subtitle={t("describeHint")} />
      {error && <div className="mb-4"><Alert tone="critical">{error}</Alert></div>}
      <Card>
        <div className="space-y-4">
          <Field label={t("describe")} htmlFor="desc">
            <Textarea
              id="desc"
              rows={7}
              value={text}
              lang={lang}
              maxLength={5000}
              onChange={(e) => setText(e.target.value)}
              placeholder={lang === "hi" ? "उदा. Kasba Peth में 3 दिनों से पानी नहीं आ रहा है…" : lang === "mr" ? "उदा. Kasba Peth मध्ये 3 दिवसांपासून पाणी येत नाही…" : "e.g. No water supply in Kasba Peth for the last 3 days…"}
            />
          </Field>
          <Field label={t("location")} htmlFor="where">
            <Input id="where" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Near Ganesh temple, Ward 2" />
          </Field>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
            <div className="flex items-center gap-3">
              {recorder.recording ? (
                <Button variant="danger" onClick={recorder.stop}>
                  <MicOff className="h-4 w-4" aria-hidden /> {t("stop")}
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  onClick={recorder.start}
                  disabled={!recorder.supported || !sttAvailable || busy !== null}
                  loading={busy === "transcribe"}
                  title={!sttAvailable ? "Voice input needs Whisper on the server (backend/requirements-ml.txt)" : undefined}
                >
                  <Mic className="h-4 w-4" aria-hidden /> {t("speak")}
                </Button>
              )}
              {recorder.recording && <span className="flex items-center gap-1.5 text-sm text-red-700"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> Recording…</span>}
              {!sttAvailable && status.data && <span className="text-xs text-ink-muted">Voice input is not enabled on this server.</span>}
              {recorder.error && <span className="text-xs text-red-700">{recorder.error}</span>}
            </div>
            <Button onClick={analyze} disabled={text.trim().length < 10 || busy !== null} loading={busy === "analyze"}>
              <Sparkles className="h-4 w-4" aria-hidden /> {t("analyze")}
            </Button>
          </div>
        </div>
      </Card>
      <p className="mt-3 text-xs text-ink-muted">
        Your description is analysed to suggest a category and department. Nothing is submitted until you review and confirm. Audio recordings are transcribed and not stored.
      </p>
    </div>
  );
}
