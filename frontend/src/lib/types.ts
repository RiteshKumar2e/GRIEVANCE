export type Role = "citizen" | "officer" | "dept_admin" | "admin";
export type Lang = "en" | "hi" | "mr";
export type Status = "SUBMITTED" | "PENDING_REVIEW" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CLOSED" | "REOPENED";
export type Urgency = "low" | "medium" | "high" | "critical";

export interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string | null;
  role: Role;
  preferred_language: Lang;
  officer_code?: string | null;
  department_code?: string | null;
  department_name?: string | null;
  designation?: string | null;
  handles_sensitive?: boolean | null;
  address?: string | null;
  ward?: string | null;
  notification_prefs?: Record<string, boolean>;
  created_at?: string | null;
  last_login_at?: string | null;
  password_changed_at?: string | null;
  permissions?: string[];
  editable_fields?: string[];
}

export interface TokenResponse {
  access_token: string;
  expires_in: number;
  user: User;
}

export interface Sla {
  due_at: string | null;
  sla_hours: number | null;
  state: "on_track" | "at_risk" | "breached" | "met" | "missed" | null;
  hours_remaining: number | null;
  predicted_resolution_hours: number | null;
  breach_probability: number | null;
  estimate_label: string | null;
  basis?: { basis?: string; sample_size?: number; department_load?: { open: number; capacity: number; ratio: number } } | null;
}

export interface CategoryRef {
  code: string;
  name_en: string;
  name_hi?: string | null;
  name_mr?: string | null;
}

export interface GrievanceSummary {
  id: number;
  public_id: string;
  title: string;
  status: Status;
  urgency: Urgency;
  language: Lang;
  ward: string | null;
  location_text: string | null;
  category: CategoryRef | null;
  department: { code: string; name: string } | null;
  assigned_officer: { code: string; name: string } | null;
  ai_confidence: number | null;
  needs_human_review: boolean;
  is_sensitive: boolean;
  identity_hidden: boolean;
  escalation_level: number;
  reopen_count: number;
  duplicate_group: string | null;
  data_source: "SYNTHETIC" | "OFFICIAL" | "LIVE";
  is_historical: boolean;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  sla: Sla | null;
  /** Staff lists only; masked or hidden according to the viewer's permissions. */
  citizen?: { name: string; phone: string | null; email: string | null; protected?: boolean } | null;
}

export interface HistoryItem {
  from_status: Status | null;
  to_status: Status;
  actor_type: string;
  actor_label: string;
  note: string;
  created_at: string;
}

export interface Precedent {
  rank: number;
  similarity: number;
  summary: string;
  scope: string;
  public_id: string;
  category: string | null;
  ward: string | null;
  data_source: string;
}

export interface DuplicateRef {
  public_id: string;
  status: Status;
  ward: string | null;
  title: string;
  created_at: string;
  score: number;
  signals: Record<string, number | null>;
  linked_by: string;
}

export interface AuditItem {
  action: string;
  actor: string;
  actor_type: string;
  provider: string | null;
  model: string | null;
  confidence: number | null;
  explanation: Record<string, unknown>;
  policy_refs: string[];
  trace_id: string | null;
  created_at: string;
}

export interface GrievanceDetail extends GrievanceSummary {
  description: string;
  input_mode: string;
  latitude: number | null;
  longitude: number | null;
  resolution_summary: string | null;
  citizen_feedback: string | null;
  citizen_rating: number | null;
  closed_at: string | null;
  citizen: { name: string; phone: string | null; email: string | null; protected?: boolean } | null;
  status_history: HistoryItem[];
  duplicate_group_size?: number;
  ai_summary?: string | null;
  ai_provider?: string | null;
  review_reasons?: string[];
  policy_explanation?: {
    policy_refs: string[];
    policy_text: Record<string, string>;
    review_reasons: string[];
    threshold: number;
    confidence: number;
    sla_hours: number;
    allowed_ai_actions: string[];
    forbidden_ai_actions: string[];
    requires_human_review: boolean;
    reasoning?: string[];
    intake_reasoning?: string[];
  } | null;
  precedents?: Precedent[];
  duplicates?: DuplicateRef[];
  notes?: { id: number; body: string; author: string; created_at: string }[];
  audit?: AuditItem[];
  eligible_officers?: { code: string; name: string; handles_sensitive: boolean }[];
}

export interface Extraction {
  language: Lang;
  category_code: string;
  category_confidence: number;
  alternatives: { category_code: string; score: number }[];
  urgency: Urgency;
  title: string;
  summary: string;
  location_text: string | null;
  ward: string | null;
  key_facts: string[];
  injection_suspected: boolean;
  sensitive_signals: string[];
  reasoning?: string[];
  provider: string;
  model: string;
  method: string;
  provider_attempts: { provider: string; status: string; reason?: string; error?: string }[];
  category: CategoryRef & { is_sensitive: boolean; hide_identity: boolean; sla_hours: number };
  department: { code: string; name: string } | null;
  latitude: number | null;
  longitude: number | null;
  policy_preview: { requires_human_review: boolean; review_reasons: string[]; is_sensitive: boolean; hide_identity: boolean; sla_hours: number };
}

export interface Draft {
  draft_token: string;
  expires_at: string;
  trace_id: string | null;
  raw_text: string;
  extraction: Extraction;
}

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string;
  is_read: boolean;
  channel: string;
  grievance_id: string | null;
  created_at: string;
}

export interface CategoryMeta extends CategoryRef {
  description: string;
  department_code: string | null;
  sla_hours: number;
  is_sensitive: boolean;
  hide_identity: boolean;
  data_source: string;
}

export interface SystemStatus {
  app: string;
  llm: { mode: "llm" | "fallback"; chain: string[]; groq: { configured: boolean; model: string }; gemini: { configured: boolean; model: string } };
  embeddings: { provider: string };
  speech_to_text: { available: boolean; model: string };
  database: { engine: string };
  data_sources: { grievances: Record<string, number>; category_master: string[] };
  synthetic_data_in_use: boolean;
  langfuse: { enabled: boolean };
}
