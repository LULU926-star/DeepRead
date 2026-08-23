import type {
  ApiErrorBody,
  BibtexResult,
  Chunk,
  Conversation,
  ConversationDetail,
  ConversationTurn,
  ConversationTurnJob,
  CreateConversationInput,
  CreateConversationTurnInput,
  IndexResult,
  MethodComparisonTable,
  Paper,
  PaperSimilarity,
  ProgressEvent,
  RetryConversationTurnInput,
  Review,
  ReviewAngle,
  SessionInfo,
  UpdateConversationInput,
  UploadResult,
} from '../types';

const API_ROOT = '/api';

export class DeepReadApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, message: string, code = 'request_failed', details?: unknown) {
    super(message);
    this.name = 'DeepReadApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof Blob) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  if (!response.ok) {
    let body: ApiErrorBody | undefined;
    try {
      body = (await response.json()) as ApiErrorBody;
    } catch {
      body = undefined;
    }
    throw new DeepReadApiError(
      response.status,
      body?.error?.message || body?.detail || response.statusText || 'Request failed',
      body?.error?.code,
      body?.error?.details,
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const jsonBody = (value: unknown): string => JSON.stringify(value);

export const deepreadApi = {
  health: (signal?: AbortSignal) => request<{ status: string }>('/health', { signal }),

  listSessions: (signal?: AbortSignal) =>
    request<SessionInfo[]>('/sessions', { signal }),

  createSession: (name?: string, signal?: AbortSignal) =>
    request<SessionInfo>('/sessions', {
      method: 'POST',
      body: jsonBody({ name: name?.trim() || undefined }),
      signal,
    }),

  getSession: (sessionId: string, signal?: AbortSignal) =>
    request<SessionInfo>(`/sessions/${encodeURIComponent(sessionId)}`, { signal }),

  deleteSession: (sessionId: string) =>
    request<void>(`/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' }),

  listPapers: (sessionId: string, signal?: AbortSignal) =>
    request<Paper[]>(`/sessions/${encodeURIComponent(sessionId)}/papers`, { signal }),

  uploadPaper: (sessionId: string, file: File, signal?: AbortSignal) =>
    request<UploadResult>(
      `/sessions/${encodeURIComponent(sessionId)}/papers?filename=${encodeURIComponent(file.name)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/pdf' },
        body: file,
        signal,
      },
    ),

  deletePaper: (sessionId: string, paperId: string) =>
    request<void>(
      `/sessions/${encodeURIComponent(sessionId)}/papers/${encodeURIComponent(paperId)}`,
      { method: 'DELETE' },
    ),

  retryPaper: (sessionId: string, paperId: string) =>
    request<UploadResult>(
      `/sessions/${encodeURIComponent(sessionId)}/papers/${encodeURIComponent(paperId)}/retry`,
      { method: 'POST' },
    ),

  indexPaper: (sessionId: string, paperId: string, force = true) =>
    request<IndexResult>(
      `/sessions/${encodeURIComponent(sessionId)}/papers/${encodeURIComponent(paperId)}/index?force=${force}`,
      { method: 'POST' },
    ),

  getProgress: (jobId: string, signal?: AbortSignal) =>
    request<ProgressEvent>(`/jobs/${encodeURIComponent(jobId)}`, { signal }),

  listConversations: async (
    sessionId: string,
    includeArchived = true,
    signal?: AbortSignal,
  ) => {
    const result = await request<Conversation[] | { items: Conversation[] }>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations?include_archived=${includeArchived}`,
      { signal },
    );
    return Array.isArray(result) ? result : result.items;
  },

  createConversation: (
    sessionId: string,
    input: CreateConversationInput,
    signal?: AbortSignal,
  ) =>
    request<Conversation>(`/sessions/${encodeURIComponent(sessionId)}/conversations`, {
      method: 'POST',
      body: jsonBody(input),
      signal,
    }),

  getConversation: (
    sessionId: string,
    conversationId: string,
    tipTurnId?: string | null,
    signal?: AbortSignal,
  ) => {
    const tipQuery = tipTurnId ? `?tip_turn_id=${encodeURIComponent(tipTurnId)}` : '';
    return request<ConversationDetail>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}${tipQuery}`,
      { signal },
    );
  },

  updateConversation: (
    sessionId: string,
    conversationId: string,
    input: UpdateConversationInput,
    signal?: AbortSignal,
  ) =>
    request<Conversation>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}`,
      {
        method: 'PATCH',
        body: jsonBody(input),
        signal,
      },
    ),

  deleteConversation: (sessionId: string, conversationId: string, signal?: AbortSignal) =>
    request<void>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}`,
      { method: 'DELETE', signal },
    ),

  createConversationTurn: (
    sessionId: string,
    conversationId: string,
    input: CreateConversationTurnInput,
    signal?: AbortSignal,
  ) =>
    request<ConversationTurnJob>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}/turns`,
      {
        method: 'POST',
        body: jsonBody(input),
        signal,
      },
    ),

  getConversationTurn: (
    sessionId: string,
    conversationId: string,
    turnId: string,
    signal?: AbortSignal,
  ) =>
    request<ConversationTurn>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}`,
      { signal },
    ),

  cancelConversationTurn: (
    sessionId: string,
    conversationId: string,
    turnId: string,
    signal?: AbortSignal,
  ) =>
    request<ConversationTurn>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/cancel`,
      { method: 'POST', signal },
    ),

  retryConversationTurn: (
    sessionId: string,
    conversationId: string,
    turnId: string,
    input: RetryConversationTurnInput,
    signal?: AbortSignal,
  ) =>
    request<ConversationTurnJob>(
      `/sessions/${encodeURIComponent(sessionId)}/conversations/${encodeURIComponent(conversationId)}/turns/${encodeURIComponent(turnId)}/retry`,
      {
        method: 'POST',
        body: jsonBody(input),
        signal,
      },
    ),

  search: (
    sessionId: string,
    query: string,
    paperIds?: string[],
    topK = 8,
    signal?: AbortSignal,
  ) =>
    request<Chunk[]>(`/sessions/${encodeURIComponent(sessionId)}/search`, {
      method: 'POST',
      body: jsonBody({ query, paper_ids: paperIds?.length ? paperIds : undefined, top_k: topK }),
      signal,
    }),

  listReviews: (sessionId: string, signal?: AbortSignal) =>
    request<Review[]>(`/sessions/${encodeURIComponent(sessionId)}/reviews`, { signal }),

  getReview: (sessionId: string, reviewId: string, signal?: AbortSignal) =>
    request<Review>(
      `/sessions/${encodeURIComponent(sessionId)}/reviews/${encodeURIComponent(reviewId)}`,
      { signal },
    ),

  generateReview: (
    sessionId: string,
    input: { angle: ReviewAngle; paper_ids?: string[]; custom_prompt?: string },
    signal?: AbortSignal,
  ) =>
    request<Review>(`/sessions/${encodeURIComponent(sessionId)}/reviews`, {
      method: 'POST',
      body: jsonBody(input),
      signal,
    }),

  compareMethods: (sessionId: string, paperIds?: string[], signal?: AbortSignal) =>
    request<MethodComparisonTable>(`/sessions/${encodeURIComponent(sessionId)}/compare`, {
      method: 'POST',
      body: jsonBody({ paper_ids: paperIds?.length ? paperIds : undefined }),
      signal,
    }),

  generateBibtex: (sessionId: string, paperIds?: string[], signal?: AbortSignal) =>
    request<BibtexResult>(`/sessions/${encodeURIComponent(sessionId)}/bibtex`, {
      method: 'POST',
      body: jsonBody({ paper_ids: paperIds?.length ? paperIds : undefined }),
      signal,
    }),

  findSimilar: (sessionId: string, paperId: string, topK = 3, signal?: AbortSignal) =>
    request<PaperSimilarity[]>(
      `/sessions/${encodeURIComponent(sessionId)}/papers/${encodeURIComponent(paperId)}/similar?top_k=${topK}`,
      { signal },
    ),

  paperPdfUrl: (sessionId: string, paperId: string) =>
    `${API_ROOT}/sessions/${encodeURIComponent(sessionId)}/papers/${encodeURIComponent(paperId)}/pdf`,
};

export function apiErrorMessage(error: unknown): string {
  if (error instanceof DeepReadApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Unexpected request failure';
}
