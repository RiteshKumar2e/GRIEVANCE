import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useSystemStatus } from "../../components/AppShell";
import { ConfidenceMeter, ReadAloud, ReasoningList, UrgencyBadge } from "../../components/domain";
import { IconMic, IconSend, IconStop } from "../../components/icons";
import { useToast } from "../../components/Toast";
import { Alert, Button, Field, Input, PageHeader, Select } from "../../components/ui";
import { api } from "../../lib/api";
import { URGENCY_ORDER } from "../../lib/format";
import { categoryName, LANG_LABEL, useI18n } from "../../lib/i18n";
import type { CategoryMeta, Draft, GrievanceDetail, Urgency } from "../../lib/types";

type Msg = { role: "user" | "assistant"; content: string };
interface ConverseOut {
  reply: string;
  ready: boolean;
  language: "en" | "hi" | "mr";
  missing: string[];
  draft: Draft | null;
}

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
  const toast = useToast();
  const nav = useNavigate();
  const status = useSystemStatus();
  const cats = useQuery({ queryKey: ["meta", "categories"], queryFn: () => api<CategoryMeta[]>("/meta/categories") });
  const wards = useQuery({ queryKey: ["meta", "wards"], queryFn: () => api<{ ward: string; locality: string }[]>("/meta/wards") });

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const [busy, setBusy] = useState<null | "chat" | "transcribe" | "submit">(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [edits, setEdits] = useState({ title: "", category_code: "", location_text: "", ward: "", urgency: "medium" as Urgency });
  const [consent, setConsent] = useState(false);
  const logRef = useRef<HTMLOListElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [messages, busy]);

  const recorder = useRecorder(async (blob) => {
    setBusy("transcribe");
    setError(null);
    const form = new FormData();
    form.append("audio", blob, "recording.webm");
    form.append("language", lang);
    try {
      const r = await api<{ text: string }>("/citizen/intake/transcribe", { form });
      setInput((prev) => (prev ? `${prev} ${r.text}` : r.text));
      setUsedVoice(true);
      toast.info(t("voiceReview"));
      inputRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription failed");
    } finally {
      setBusy(null);
    }
  });

  const converse = async (next: Msg[], finish = false) => {
    setBusy("chat");
    setError(null);
    try {
      const r = await api<ConverseOut>("/citizen/intake/converse", { body: { messages: next, language: lang, input_mode: usedVoice ? "voice" : "text", finish } });
      setMessages([...next, { role: "assistant", content: r.reply }]);
      if (r.ready && r.draft) {
        const ex = r.draft.extraction;
        setDraft(r.draft);
        setEdits({ title: ex.title, category_code: ex.category_code, location_text: ex.location_text ?? "", ward: ex.ward ?? "", urgency: ex.urgency });
        setConsent(false);
      }
    } catch (e) {
      setMessages(next);
      setError(e instanceof Error ? e.message : "The assistant could not respond");
    } finally {
      setBusy(null);
    }
  };

  const send = (e?: FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (text.length < 2 || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    void converse(next);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
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
      toast.success(`Grievance ${g.public_id} registered.`);
      nav(`/citizen/grievances/${g.public_id}?new=1`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submission failed");
      setBusy(null);
    }
  };

  const restart = () => {
    if (draft) void api(`/citizen/intake/${draft.draft_token}/discard`, { method: "POST" }).catch(() => undefined);
    setDraft(null);
    setMessages([]);
    setInput("");
    setUsedVoice(false);
  };

  const ex = draft?.extraction;
  const selectedCat = useMemo(() => cats.data?.find((c) => c.code === edits.category_code), [cats.data, edits.category_code]);
  const changedCategory = !!ex && edits.category_code !== ex.category_code;
  const minUrgency = ex ? URGENCY_ORDER.indexOf(ex.urgency) : 0;
  const sttAvailable = !!status.data?.speech_to_text.available;
  const userTurns = messages.filter((m) => m.role === "user").length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={draft ? t("reviewTitle") : t("fileComplaint")} subtitle={draft ? t("reviewHint") : t("describeHint")} />
      {error && (
        <div className="mb-5">
          <Alert tone="critical">{error}</Alert>
        </div>
      )}

      {/* Conversation */}
      <section aria-label="Conversation with the intake assistant" className="rounded-lg border border-line bg-surface">
        <ol ref={logRef} className="max-h-[52vh] space-y-4 overflow-y-auto px-4 py-5 sm:px-6" aria-live="polite">
          <ChatBubble role="assistant" label={t("assistant")} text={t("chatGreeting")} lang={lang} />
          {messages.map((m, i) => (
            <ChatBubble key={i} role={m.role} label={m.role === "user" ? t("you") : t("assistant")} text={m.content} lang={lang} />
          ))}
          {busy === "chat" && (
            <li className="text-[13px] text-ink-muted" role="status">
              {t("thinking")}…
            </li>
          )}
        </ol>
        {!draft && (
          <form onSubmit={send} className="border-t border-line p-3 sm:p-4">
            <label htmlFor="chat-input" className="sr-only">
              {t("describe")}
            </label>
            <textarea
              id="chat-input"
              ref={inputRef}
              rows={2}
              lang={lang}
              maxLength={3000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={t("chatPlaceholder")}
              className="w-full resize-none rounded-md border border-line bg-canvas px-3 py-2.5 text-[15px] leading-relaxed text-ink focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {recorder.recording ? (
                  <Button type="button" variant="danger" size="sm" onClick={recorder.stop}>
                    <IconStop width={16} height={16} /> {t("stop")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={recorder.start}
                    disabled={!recorder.supported || !sttAvailable || busy !== null}
                    loading={busy === "transcribe"}
                    title={!sttAvailable ? "Voice input needs Whisper on the server" : undefined}
                  >
                    <IconMic width={16} height={16} /> {t("speak")}
                  </Button>
                )}
                {recorder.recording && <span className="text-[13px] font-medium text-status-critical">Recording</span>}
                {status.data && !sttAvailable && <span className="text-[12px] text-ink-muted">Voice input is not enabled on this server.</span>}
                {recorder.error && <span className="text-[12px] text-status-critical">{recorder.error}</span>}
              </div>
              <div className="flex gap-2">
                {userTurns > 0 && (
                  <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => converse(messages, true)}>
                    {t("draftNow")}
                  </Button>
                )}
                <Button type="submit" size="sm" disabled={input.trim().length < 2 || busy !== null}>
                  <IconSend width={16} height={16} /> {t("send")}
                </Button>
              </div>
            </div>
          </form>
        )}
      </section>
      {!draft && (
        <p className="mt-3 text-[13px] text-ink-muted">
          The assistant asks a few questions, then prepares a draft. Nothing is filed until you review and confirm it. Audio is transcribed and not stored.
        </p>
      )}

      {/* Draft review */}
      {draft && ex && (
        <div className="mt-8 space-y-6">
          <section className="rounded-lg border border-line bg-surface">
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">Draft prepared by the assistant</h2>
              <span className="text-[12px] text-ink-muted">
                {ex.method === "rules" ? "Rule-based analysis (no LLM)" : `Analysed by ${ex.provider} · ${ex.model}`}
              </span>
            </header>
            <div className="grid gap-5 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">Summary for the officer</p>
                  <ReadAloud text={`${ex.title}. ${categoryName(selectedCat ?? ex.category, lang)}. ${ex.location_text ?? ""}`} lang={lang} label={t("listen")} />
                </div>
                <p className="mt-1 text-[15px] text-ink">{ex.summary}</p>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">Classification confidence</p>
                <div className="mt-2">
                  <ConfidenceMeter value={ex.category_confidence} />
                </div>
              </div>
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.06em] text-ink-muted">{t("department")}</p>
                <p className="mt-1 text-sm font-medium">{selectedCat?.department_code === ex.department?.code ? ex.department?.name : selectedCat?.department_code ?? "Not mapped"}</p>
              </div>
              <details className="sm:col-span-2">
                <summary className="cursor-pointer text-[13px] font-medium text-brand-700">How the assistant reached this</summary>
                <div className="mt-3">
                  <ReasoningList lines={ex.reasoning ?? []} compact />
                </div>
              </details>
            </div>
          </section>

          {(ex.policy_preview.is_sensitive || selectedCat?.is_sensitive) && (
            <Alert tone="warning" title="Sensitive matter">
              {t("sensitiveNote")}
            </Alert>
          )}
          {(ex.policy_preview.requires_human_review || changedCategory) && !ex.policy_preview.is_sensitive && <Alert tone="info">{t("reviewNote")}</Alert>}

          <section className="rounded-lg border border-line bg-surface p-5">
            <h2 className="mb-4 text-[15px] font-semibold">Details to confirm</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Field label={t("title")} htmlFor="title">
                  <Input id="title" value={edits.title} maxLength={300} onChange={(e) => setEdits((s) => ({ ...s, title: e.target.value }))} />
                </Field>
              </div>
              <Field label={t("category")} htmlFor="cat" hint={changedCategory ? "You changed the suggested category. An officer will verify it." : undefined}>
                <Select id="cat" value={edits.category_code} onChange={(e) => setEdits((s) => ({ ...s, category_code: e.target.value }))}>
                  {cats.data?.map((c) => (
                    <option key={c.code} value={c.code}>
                      {categoryName(c, lang)}
                      {c.code === ex.category_code ? " (suggested)" : ex.alternatives.some((a) => a.category_code === c.code) ? " (possible)" : ""}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("urgency")} htmlFor="urg" hint="You can raise the urgency. The assistant's safety estimate is never lowered.">
                <Select id="urg" value={edits.urgency} onChange={(e) => setEdits((s) => ({ ...s, urgency: e.target.value as Urgency }))}>
                  {URGENCY_ORDER.map((u, i) => (
                    <option key={u} value={u} disabled={i < minUrgency}>
                      {u}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Location" htmlFor="loc">
                <Input id="loc" value={edits.location_text} onChange={(e) => setEdits((s) => ({ ...s, location_text: e.target.value }))} />
              </Field>
              <Field label="Ward" htmlFor="ward">
                <Select id="ward" value={edits.ward} onChange={(e) => setEdits((s) => ({ ...s, ward: e.target.value }))}>
                  <option value="">Not sure</option>
                  {wards.data?.map((w) => (
                    <option key={w.ward} value={w.ward}>
                      {w.ward}, {w.locality}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] text-ink-soft">
              <span>Urgency</span> <UrgencyBadge urgency={edits.urgency} />
              {selectedCat && <span className="ml-2">SLA target {selectedCat.sla_hours} hours</span>}
              <span className="ml-2">Language {LANG_LABEL[ex.language]}</span>
            </div>
          </section>

          <section className="rounded-lg border border-line bg-surface p-5">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-brand-700" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span lang={lang}>{t("consent")}</span>
            </label>
            <div className="mt-5 flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={restart}>
                {t("edit")}
              </Button>
              <Button onClick={submit} disabled={!consent || !edits.category_code} loading={busy === "submit"}>
                {t("confirmSubmit")}
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ChatBubble({ role, label, text, lang }: { role: "user" | "assistant"; label: string; text: string; lang: string }) {
  const mine = role === "user";
  return (
    <li className={clsx("flex", mine ? "justify-end" : "justify-start")}>
      <div className={clsx("max-w-[85%] sm:max-w-[75%]")}>
        <p className={clsx("mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted", mine && "text-right")}>{label}</p>
        <p
          lang={lang}
          className={clsx(
            "whitespace-pre-wrap break-words rounded-lg px-3.5 py-2.5 text-[15px] leading-relaxed",
            mine ? "bg-brand-700 text-white" : "border border-line bg-canvas text-ink",
          )}
        >
          {text}
        </p>
      </div>
    </li>
  );
}
