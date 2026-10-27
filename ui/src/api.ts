// API client and types for the workbench BFF.

export interface Workflow { code: string; name: string; description: string; autonomy_tier: string; threshold: number; stp_target: number | null; live: boolean }
export interface NavTeam { id: string; name: string; stage: number | null; stage_name: string; kind: string; workflows: Workflow[] }
export interface Me {
  user_id: string; name: string; title: string; email: string; groups: string[]; oversight: boolean; audit: boolean;
  teams: string[]; makers: string[]; checkers: string[]; scope: string;
  nav: { oversight: boolean; teams: NavTeam[]; my_workflows: (Workflow & { team_id: string })[] };
}
export interface Check { id: string; label: string; status: 'passed' | 'failed' | 'warning' | 'placeholder' | 'pending'; detail: string; source: string }
export interface Field {
  path?: string; label: string; value: unknown; confidence: number; status: string; page?: number | null;
  bbox?: number[] | null; where?: string; rules?: { rule: string; passed: boolean; message: string }[];
  corrected_by?: string; original?: unknown; required?: boolean;
}
export interface Evidence {
  document_id: string; title: string; summary?: string; filename?: string; channel?: string; received_at?: string;
  source_ref?: string; method?: string; pack?: string; fields: Field[]; demo?: boolean;
}
export interface DiffRow { field: string; label: string; current: string | null; proposed: string | null; changed: boolean }
export interface Diff { currency: string; asset_class: string; current_record_id: string | null; is_new: boolean; rows: DiffRow[] }
export interface CaseEvent { id: number; at: string; actor_type: string; actor_name: string | null; kind: string; summary: string; detail: Record<string, unknown> }
export interface Case {
  id: string; workflow_code: string; workflow_name: string; team_id: string; team_name: string; title: string; description: string | null;
  counterparty_id: string | null; counterparty_name: string | null; trade_ref: string | null; value_amount: number | null; value_ccy: string | null;
  priority: 'P1' | 'P2' | 'P3'; priority_reason: string | null; cutoff_at: string | null; state: string; waiting_on: string | null;
  assignee_name: string | null; agent_name: string | null; correlation_id: string | null;
  diagnosis: { title: string; summary: string; confidence: number; threshold: number; agent: string } | null;
  proposed_action: { kind: string; text: string } | null;
  checks: Check[]; evidence: Evidence[];
  payload: { counterparty_id?: string; effective_date?: string; instructions?: Record<string, string | null>[];
    callback?: { phone_on_file?: string | null; contact?: string | null; phone_in_letter?: string | null }; diffs?: Diff[] } | null;
  callback: { outcome: string; number_called: string; contact_name: string; by_name: string; at: string; notes?: string; payload_version: number } | null;
  payload_version: number; maker_name: string | null; checker_name: string | null; submitted_at: string | null; decided_at: string | null;
  sor_result: { created?: string[]; end_dated?: string[]; effective_date?: string; error?: string } | null;
  outcome: string | null; is_demo: boolean; created_at: string; closed_at: string | null; autonomy_tier: string;
  events?: CaseEvent[]; document_ids?: string[];
  can?: { act: boolean; submit: boolean; approve: boolean; decline: boolean; read_only: boolean };
}
export interface Stage { team_id: string; team_name: string; stage: number | null; stage_name: string; kind: string; cases_today: number; stp_rate: number | null; stp_label: string | null; p1: number; p2: number; p3: number; health: string; demo: boolean }
export interface Overview { scope: string; kpis: { cases_today: number; stp_rate: number | null; pending_review: number; p1_open: number; analyst_hours_avoided: number }; stages: Stage[] }
export interface TeamSummary {
  team: { id: string; name: string; description: string; stage: number | null; stage_name: string; workflows: Workflow[] };
  stats: { cases_today: number; stp_rate: number | null; auto_closed: number; resolved_by_reviewer: number; p1: number; p2: number; p3: number; open: number; review: number; waiting: number; awaiting_approval: number; demo: boolean };
  callbacks_mandatory: number; workflows: (Workflow & { health: string; stp_vs_target: string })[]; scope: string;
}
export interface Activity { activity_id: string; at: string; source: string; actor_type: string; actor: string; action: string; outcome: string; summary: string; correlation_id: string | null; case_id: string | null; item_id: string | null; team: string | null; detail: Record<string, unknown> }
export interface Alert { id: number; team_id: string; case_id: string | null; severity: string; title: string; created_at: string; is_demo: boolean }
export interface Citation { kind: string; ref: string; label: string; page?: number; text?: string }
export interface AskAnswer { answer: string; citations: Citation[]; mode: string }
export interface Extraction { extraction_id: string; document_id: string; pack_id: string; pack_version: string; method: string; data: Record<string, unknown>; fields: Field[]; issues: string[]; overall_confidence: number }
export interface Envelope { id: string; document_id: string; status: string; filename: string; correlation_id: string; route_team: string | null }

const TOKEN_KEY = 'ptap.token';
let memoryToken: string | null = null;

export function getToken(): string | null {
  try { return sessionStorage.getItem(TOKEN_KEY) ?? memoryToken; } catch { return memoryToken; }
}
export function setToken(token: string | null) {
  memoryToken = token;
  try { if (token) sessionStorage.setItem(TOKEN_KEY, token); else sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage blocked */ }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const resp = await fetch(path, { ...init, headers });
  if (resp.status === 401) {
    setToken(null);
    if (!location.pathname.startsWith('/login')) location.assign('/login');
    throw new ApiError(401, 'Sign in required');
  }
  if (!resp.ok) {
    let detail = resp.statusText;
    try { const j = await resp.json(); detail = typeof j.detail === 'string' ? j.detail : JSON.stringify(j.detail); } catch { /* not json */ }
    throw new ApiError(resp.status, detail);
  }
  const type = resp.headers.get('content-type') ?? '';
  return (type.includes('application/json') ? resp.json() : resp.blob()) as Promise<T>;
}

export const post = <T,>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body === undefined ? '{}' : JSON.stringify(body) });
