export type ParseStatus = 'pending' | 'parsing' | 'success' | 'failed';
export type IndexStatus = 'pending' | 'indexing' | 'ready' | 'failed';
export type PaperTag = 'focus' | 'skip' | 'reference';
export type WorkspaceView = 'chat' | 'search' | 'review' | 'compare' | 'bibtex' | 'similar';
export type ReviewAngle =
  | 'method_comparison'
  | 'timeline'
  | 'limitations'
  | 'applications'
  | 'custom';

export interface SessionInfo {
  id: string;
  name?: string | null;
  paper_count?: number;
  note_count?: number;
  review_count?: number;
  conversation_count?: number;
  storage_bytes?: number;
  created_at: string;
  updated_at?: string;
  expires_at: string;
  days_until_expiry?: number;
  is_expired?: boolean;
}

export interface PdfMetadata {
  title?: string | null;
  authors?: string | null;
  page_count?: number;
  year?: string | null;
  venue?: string | null;
  doi?: string | null;
  url?: string | null;
}

export interface Paper {
  paper_id: string;
  filename: string;
  page_count: number;
  size_bytes: number;
  parse_status: ParseStatus;
  parse_error?: string | null;
  index_status: IndexStatus;
  index_error?: string | null;
  indexed_at?: string | null;
  chunk_count: number;
  index_model?: string;
  user_tags: PaperTag[];
  metadata?: PdfMetadata | null;
  uploaded_at: string;
  pdf_available?: boolean;
  has_analysis?: boolean;
  note_count?: number;
}

export interface UploadResult {
  paper_id: string;
  session_id: string;
  status: 'pending' | 'parsing';
  filename: string;
  message?: string;
  job_id: string;
}

export interface IndexResult {
  session_id: string;
  paper_id: string;
  status: 'ready' | 'failed';
  chunk_count: number;
  indexed_at?: string | null;
  error?: string | null;
  job_id?: string;
}

export interface ProgressEvent {
  job_id: string;
  stage: string;
  current: number;
  total: number;
  message: string;
  eta_seconds?: number | null;
  completed?: boolean;
  error?: string | null;
  status: 'in_progress' | 'completed' | 'failed';
  progress: number;
}

export interface CrossPaperCitation {
  id: string;
  paper_id: string;
  chunk_id: string;
  section: string;
  section_title?: string;
  paragraph?: number | null;
  page_index?: number | null;
  snippet?: string;
  marker: string;
}

export interface Chunk {
  id: string;
  session_id: string;
  paper_id: string;
  section: string;
  section_title?: string;
  section_type?: string;
  paragraph: number;
  page_index: number;
  text: string;
  anchor_text?: string;
  token_count?: number;
  score?: number | null;
  citation: CrossPaperCitation;
}

export interface CitationOccurrence {
  start: number;
  end: number;
  citation_id: string;
  chunk_id: string;
}

export type ConversationScope = 'all_ready' | 'selected';
export type ConversationStatus = 'active' | 'archived';
export type RewriteMode = 'original' | 'llm' | 'fallback';
export type ConversationTurnStatus =
  | 'queued'
  | 'rewriting'
  | 'retrieving'
  | 'generating'
  | 'validating'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface Conversation {
  id: string;
  session_id: string;
  title: string;
  default_scope: ConversationScope;
  default_paper_ids: string[];
  active_tip_turn_id?: string | null;
  summary: string;
  summary_through_turn_id?: string | null;
  status: ConversationStatus;
  turn_count: number;
  created_at: string;
  updated_at: string;
}

export interface ConversationTurn {
  id: string;
  conversation_id: string;
  sequence: number;
  parent_turn_id?: string | null;
  retry_of_turn_id?: string | null;
  client_request_id: string;
  user_query: string;
  rewritten_query: string;
  rewrite_mode: RewriteMode;
  scope_paper_ids: string[];
  retrieved_chunks: Chunk[];
  answer_markdown: string;
  citations: CrossPaperCitation[];
  citation_occurrences: CitationOccurrence[];
  suggested_follow_ups: string[];
  status: ConversationTurnStatus;
  error_code?: string | null;
  error_message?: string | null;
  model: string;
  input_tokens: number;
  output_tokens: number;
  created_at: string;
  completed_at?: string | null;
}

export interface ConversationDetail {
  conversation: Conversation;
  turns: ConversationTurn[];
  active_branch_turn_ids: string[];
}

export interface ConversationTurnJob {
  conversation_id: string;
  turn_id: string;
  job_id: string;
  status: ConversationTurnStatus;
}

export interface CreateConversationInput {
  title?: string;
  default_scope?: ConversationScope;
  default_paper_ids?: string[];
}

export interface UpdateConversationInput {
  title?: string;
  status?: ConversationStatus;
  default_scope?: ConversationScope;
  default_paper_ids?: string[];
}

export interface CreateConversationTurnInput {
  query: string;
  parent_turn_id?: string | null;
  paper_ids?: string[];
  client_request_id: string;
}

export interface RetryConversationTurnInput {
  client_request_id: string;
  query?: string;
  paper_ids?: string[];
}

export interface ShareLink {
  id: string;
  session_id: string;
  conversation_id: string;
  tip_turn_id?: string | null;
  snapshot_version: string;
  content_sha256: string;
  include_sources: boolean;
  allow_markdown_download: boolean;
  created_at: string;
  expires_at: string;
  revoked_at?: string | null;
}

export interface ShareCreateResult {
  share: ShareLink;
  token: string;
  url: string;
}

export interface ExportPaper {
  paper_id: string;
  title: string;
  authors: string;
}

export interface ExportSection {
  id: string;
  title: string;
  markdown: string;
}

export interface ExportEvidence {
  id: string;
  paper_id: string;
  paper_title: string;
  section: string;
  section_title: string;
  page_index?: number | null;
  snippet: string;
  marker: string;
}

export interface ExportDocument {
  title: string;
  subtitle: string;
  generated_at: string;
  source_type: 'conversation' | 'review';
  paper_scope: ExportPaper[];
  sections: ExportSection[];
  evidence: ExportEvidence[];
}

export interface ExportArtifact {
  id: string;
  session_id: string;
  source_type: 'conversation' | 'review';
  source_id: string;
  tip_turn_id?: string | null;
  format: 'markdown' | 'pdf';
  options: Record<string, unknown>;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  file_path?: string | null;
  sha256?: string | null;
  size_bytes: number;
  error_code?: string | null;
  error_message?: string | null;
  created_at: string;
  expires_at: string;
}

export interface ReviewSection {
  title: string;
  content: string;
  citations: CrossPaperCitation[];
  theme?: string;
  citation_occurrences?: CitationOccurrence[];
}

export interface Review {
  id: string;
  session_id: string;
  paper_ids: string[];
  angle: ReviewAngle;
  custom_prompt?: string | null;
  themes: string[];
  sections: ReviewSection[];
  markdown?: string;
  citations: CrossPaperCitation[];
  status: 'generating' | 'completed' | 'failed';
  created_at: string;
  model?: string;
  tokens_used?: number;
}

export type ComparisonField = 'method' | 'datasets' | 'metrics' | 'results';

export interface MethodComparisonRow {
  paper_id: string;
  method: string;
  datasets: string[];
  metrics: string[];
  results: string;
  citations: CrossPaperCitation[];
  field_citations: Partial<Record<ComparisonField, CrossPaperCitation[]>>;
}

export interface MethodComparisonTable {
  rows: MethodComparisonRow[];
  markdown?: string;
  citations: CrossPaperCitation[];
}

export interface BibtexEntry {
  paper_id: string;
  key: string;
  entry: string;
}

export interface BibtexResult {
  entries: BibtexEntry[];
  content: string;
}

export interface PaperSimilarity {
  paper_id: string;
  score: number;
  target_paper_id: string;
  citations: CrossPaperCitation[];
  rationale: string;
}

export interface UploadQueueItem {
  id: string;
  file: File;
  status: 'queued' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress: number;
  stage?: string;
  message?: string;
  paperId?: string;
  jobId?: string;
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  detail?: string;
}
