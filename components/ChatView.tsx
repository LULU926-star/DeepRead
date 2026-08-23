import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FileQuestion,
  History,
  MessageSquareText,
  PanelLeftOpen,
  Plus,
} from 'lucide-react';
import { DeepReadApiError, apiErrorMessage, deepreadApi } from '../services/deepreadApi';
import type {
  Conversation,
  ConversationDetail,
  ConversationTurn,
  ConversationTurnJob,
  CrossPaperCitation,
  Paper,
  ProgressEvent,
} from '../types';
import ChatComposer from './ChatComposer';
import ChatTurn from './ChatTurn';
import SourceScopeDialog from './SourceScopeDialog';

interface ChatViewProps {
  sessionId: string;
  conversation: Conversation | null;
  papers: Paper[];
  initialSelectedPaperIds: string[];
  onConversationCreated: (conversation: Conversation) => void;
  onConversationUpdated: (conversation: Conversation) => void;
  onBeginNew: () => void;
  onOpenHistory: () => void;
  onOpenSources: () => void;
  onCitation: (citation: CrossPaperCitation) => void;
}

const terminalStatuses = new Set<ConversationTurn['status']>(['completed', 'failed', 'cancelled']);
const delay = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = window.setTimeout(resolve, milliseconds);
  signal?.addEventListener('abort', () => {
    window.clearTimeout(timer);
    reject(new DOMException('Aborted', 'AbortError'));
  }, { once: true });
});

const stageLabels: Record<string, string> = {
  starting: '准备回答',
  queued: '等待开始',
  rewriting: '改写检索问题',
  retrieving: '检索论文证据',
  generating: '撰写证据回答',
  validating: '校验引用',
  completed: '回答完成',
  failed: '生成失败',
  cancelled: '已取消',
};

const chatErrorMessage = (error: unknown): string => {
  if (error instanceof DeepReadApiError) {
    const byCode: Record<string, string> = {
      no_ready_papers: '当前没有完成索引的论文，请先在论文面板建立索引。',
      conversation_busy: '这个对话已有一轮正在生成，请等待完成或先取消。',
      idempotency_conflict: '这次提交与已有请求冲突，请刷新对话后重试。',
      turn_not_found: '目标问题不存在或已随对话删除。',
      model_unavailable: '当前模型服务不可用，问题已保留，可以稍后重试。',
      interrupted: '生成因服务重启而中断，问题和历史已经保留。',
    };
    return byCode[error.code] || error.message;
  }
  return apiErrorMessage(error);
};

const buildFallbackBranch = (detail: ConversationDetail): ConversationTurn[] => {
  const byId = new Map(detail.turns.map(turn => [turn.id, turn]));
  const path: ConversationTurn[] = [];
  let cursor = detail.conversation.active_tip_turn_id
    ? byId.get(detail.conversation.active_tip_turn_id)
    : detail.turns.at(-1);
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.unshift(cursor);
    cursor = cursor.parent_turn_id ? byId.get(cursor.parent_turn_id) : undefined;
  }
  return path;
};

const ChatView: React.FC<ChatViewProps> = ({
  sessionId,
  conversation,
  papers,
  initialSelectedPaperIds,
  onConversationCreated,
  onConversationUpdated,
  onBeginNew,
  onOpenHistory,
  onOpenSources,
  onCitation,
}) => {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [scopePaperIds, setScopePaperIds] = useState<string[]>([]);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [parentOverrideId, setParentOverrideId] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ConversationTurnJob | null>(null);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [liveMessage, setLiveMessage] = useState('');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const pollAbortRef = useRef<AbortController | null>(null);
  const operationAbortRef = useRef<AbortController | null>(null);
  const activeConversationIdRef = useRef<string | null>(conversation?.id || null);
  const callbacksRef = useRef({ onConversationCreated, onConversationUpdated });

  callbacksRef.current = { onConversationCreated, onConversationUpdated };
  activeConversationIdRef.current = conversation?.id || activeConversationIdRef.current;

  const readyPapers = useMemo(
    () => papers.filter(paper => paper.index_status === 'ready' && !paper.user_tags.includes('skip')),
    [papers],
  );
  const readyPaperIds = useMemo(() => new Set(readyPapers.map(paper => paper.paper_id)), [readyPapers]);
  const draftKey = useMemo(
    () => `deepread.chat.draft.${sessionId}.${conversation?.id || 'new'}`,
    [conversation?.id, sessionId],
  );

  const updateDraft = useCallback((value: string) => {
    setDraft(value);
    if (value) localStorage.setItem(draftKey, value);
    else localStorage.removeItem(draftKey);
  }, [draftKey]);

  useEffect(() => {
    setDraft(localStorage.getItem(draftKey) || '');
  }, [draftKey]);

  useEffect(() => {
    const defaultIds = conversation?.default_scope === 'selected'
      ? conversation.default_paper_ids
      : conversation
        ? []
        : initialSelectedPaperIds;
    setScopePaperIds(defaultIds.filter(paperId => readyPaperIds.has(paperId)));
    setParentOverrideId(null);
  }, [conversation?.id, sessionId]);

  useEffect(() => {
    setScopePaperIds(previous => previous.filter(paperId => readyPaperIds.has(paperId)));
  }, [readyPaperIds]);

  useEffect(() => () => {
    pollAbortRef.current?.abort();
    operationAbortRef.current?.abort();
  }, [sessionId]);

  const hydrateConversation = useCallback(async (
    conversationId: string,
    tipTurnId?: string | null,
    signal?: AbortSignal,
  ) => {
    const nextDetail = await deepreadApi.getConversation(sessionId, conversationId, tipTurnId, signal);
    if (activeConversationIdRef.current !== conversationId) return nextDetail;
    setDetail(nextDetail);
    callbacksRef.current.onConversationUpdated(nextDetail.conversation);
    return nextDetail;
  }, [sessionId]);

  useEffect(() => {
    pollAbortRef.current?.abort();
    setActiveJob(null);
    setProgress(null);
    setError(null);
    setDetail(null);
    activeConversationIdRef.current = conversation?.id || null;
    if (!conversation) {
      setLoading(false);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    void hydrateConversation(conversation.id, null, controller.signal)
      .catch(requestError => {
        if (!(requestError instanceof DOMException && requestError.name === 'AbortError')) {
          setError(chatErrorMessage(requestError));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [conversation?.id, hydrateConversation]);

  const branchTurns = useMemo(() => {
    if (!detail) return [];
    if (!detail.active_branch_turn_ids.length) return buildFallbackBranch(detail);
    const byId = new Map(detail.turns.map(turn => [turn.id, turn]));
    return detail.active_branch_turn_ids
      .map(turnId => byId.get(turnId))
      .filter((turn): turn is ConversationTurn => Boolean(turn));
  }, [detail]);

  const siblingsByTurnId = useMemo(() => {
    const result = new Map<string, ConversationTurn[]>();
    if (!detail) return result;
    detail.turns.forEach(turn => {
      const siblings = detail.turns.filter(candidate => candidate.parent_turn_id === turn.parent_turn_id);
      result.set(turn.id, siblings);
    });
    return result;
  }, [detail]);

  const runningTurn = useMemo(
    () => branchTurns.findLast(turn => !terminalStatuses.has(turn.status)) || null,
    [branchTurns],
  );

  const pollTurn = useCallback(async (conversationId: string, turnId: string, controller: AbortController) => {
    try {
      for (let attempt = 0; attempt < 3600; attempt += 1) {
        const turn = await deepreadApi.getConversationTurn(sessionId, conversationId, turnId, controller.signal);
        if (activeConversationIdRef.current !== conversationId) return;
        setDetail(previous => previous ? {
          ...previous,
          turns: previous.turns.some(item => item.id === turn.id)
            ? previous.turns.map(item => item.id === turn.id ? turn : item)
            : [...previous.turns, turn],
        } : previous);
        if (terminalStatuses.has(turn.status)) {
          await hydrateConversation(conversationId, null, controller.signal);
          setBusy(false);
          setLiveMessage(turn.status === 'completed' ? '回答已完成' : statusForTurn(turn));
          return;
        }
        await delay(900, controller.signal);
      }
      throw new Error('回答等待超时，请刷新对话。');
    } catch (pollError) {
      if (controller.signal.aborted) return;
      setBusy(false);
      setError(chatErrorMessage(pollError));
    }
  }, [hydrateConversation, sessionId]);

  useEffect(() => {
    if (!conversation || !runningTurn || busy || activeJob) return;
    const controller = new AbortController();
    pollAbortRef.current = controller;
    setBusy(true);
    void pollTurn(conversation.id, runningTurn.id, controller);
    return () => controller.abort();
  }, [activeJob, busy, conversation?.id, pollTurn, runningTurn?.id]);

  useEffect(() => {
    if (!branchTurns.length) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    transcriptEndRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'end' });
  }, [branchTurns.length, branchTurns.at(-1)?.status]);

  const pollJob = useCallback(async (job: ConversationTurnJob, conversationId: string) => {
    pollAbortRef.current?.abort();
    const controller = new AbortController();
    pollAbortRef.current = controller;
    try {
      for (let attempt = 0; attempt < 3600; attempt += 1) {
        const nextProgress = await deepreadApi.getProgress(job.job_id, controller.signal);
        if (activeConversationIdRef.current !== conversationId) return;
        setProgress(nextProgress);
        if (nextProgress.error || nextProgress.status === 'failed') {
          await hydrateConversation(conversationId, null, controller.signal);
          setError(nextProgress.error || nextProgress.message || '回答生成失败');
          setLiveMessage('回答生成失败');
          return;
        }
        if (nextProgress.completed || nextProgress.status === 'completed') {
          await hydrateConversation(conversationId, null, controller.signal);
          setLiveMessage('回答已完成');
          return;
        }
        await delay(800, controller.signal);
      }
      throw new Error('回答等待超时，请刷新对话。');
    } catch (pollError) {
      if (controller.signal.aborted) return;
      try {
        const turn = await deepreadApi.getConversationTurn(sessionId, conversationId, job.turn_id);
        if (!terminalStatuses.has(turn.status)) {
          await pollTurn(conversationId, turn.id, controller);
          return;
        }
        await hydrateConversation(conversationId, null);
      } catch {
        setError(chatErrorMessage(pollError));
      }
    } finally {
      if (!controller.signal.aborted && activeConversationIdRef.current === conversationId) {
        setBusy(false);
        setActiveJob(null);
        setProgress(null);
      }
    }
  }, [hydrateConversation, pollTurn, sessionId]);

  const submitQuery = useCallback(async (queryValue?: string, explicitParentId?: string | null) => {
    const query = (queryValue ?? draft).trim();
    if (!query || query.length > 4000 || !readyPapers.length || busy) return;
    setBusy(true);
    setError(null);
    setLiveMessage('问题已提交');
    const controller = new AbortController();
    operationAbortRef.current = controller;
    let targetConversation = conversation;

    try {
      if (!targetConversation) {
        targetConversation = await deepreadApi.createConversation(sessionId, {
          title: query.slice(0, 40),
          default_scope: scopePaperIds.length ? 'selected' : 'all_ready',
          default_paper_ids: scopePaperIds,
        }, controller.signal);
        activeConversationIdRef.current = targetConversation.id;
        localStorage.setItem(`deepread.chat.draft.${sessionId}.${targetConversation.id}`, query);
        callbacksRef.current.onConversationCreated(targetConversation);
      }

      const parentTurnId = explicitParentId !== undefined
        ? explicitParentId
        : parentOverrideId || branchTurns.at(-1)?.id || targetConversation.active_tip_turn_id || null;
      const job = await deepreadApi.createConversationTurn(sessionId, targetConversation.id, {
        query,
        parent_turn_id: parentTurnId || undefined,
        paper_ids: scopePaperIds.length ? scopePaperIds : undefined,
        client_request_id: crypto.randomUUID(),
      }, controller.signal);
      setActiveJob(job);
      setParentOverrideId(null);
      localStorage.removeItem(draftKey);
      localStorage.removeItem(`deepread.chat.draft.${sessionId}.${targetConversation.id}`);
      setDraft('');
      await hydrateConversation(targetConversation.id, null, controller.signal);
      void pollJob(job, targetConversation.id);
    } catch (submitError) {
      if (!(submitError instanceof DOMException && submitError.name === 'AbortError')) {
        setError(chatErrorMessage(submitError));
      }
      setBusy(false);
    }
  }, [branchTurns, busy, conversation, draft, draftKey, hydrateConversation, parentOverrideId, pollJob, readyPapers.length, scopePaperIds, sessionId]);

  const cancelTurn = async () => {
    const conversationId = conversation?.id || activeJob?.conversation_id;
    const turnId = activeJob?.turn_id || runningTurn?.id;
    if (!conversationId || !turnId) return;
    try {
      await deepreadApi.cancelConversationTurn(sessionId, conversationId, turnId);
      pollAbortRef.current?.abort();
      await hydrateConversation(conversationId);
      setLiveMessage('本轮已取消');
      setActiveJob(null);
      setProgress(null);
      setBusy(false);
    } catch (cancelError) {
      setError(chatErrorMessage(cancelError));
    }
  };

  const retryTurn = async (turn: ConversationTurn) => {
    if (!conversation || busy) return;
    setBusy(true);
    setError(null);
    try {
      const job = await deepreadApi.retryConversationTurn(sessionId, conversation.id, turn.id, {
        client_request_id: crypto.randomUUID(),
        paper_ids: turn.scope_paper_ids,
      });
      setActiveJob(job);
      await hydrateConversation(conversation.id);
      void pollJob(job, conversation.id);
    } catch (retryError) {
      setError(chatErrorMessage(retryError));
      setBusy(false);
    }
  };

  const continueFromTurn = (turn: ConversationTurn, nextDraft?: string) => {
    setParentOverrideId(turn.id);
    if (nextDraft !== undefined) updateDraft(nextDraft);
    window.requestAnimationFrame(() => composerRef.current?.focus());
  };

  const selectBranch = async (turnId: string) => {
    if (!conversation || busy) return;
    setLoading(true);
    setError(null);
    try {
      await hydrateConversation(conversation.id, turnId);
      setParentOverrideId(null);
    } catch (branchError) {
      setError(chatErrorMessage(branchError));
    } finally {
      setLoading(false);
    }
  };

  const currentStage = progress?.stage || runningTurn?.status || activeJob?.status || null;
  const stageLabel = currentStage ? stageLabels[currentStage] || progress?.message || currentStage : null;
  const parentTurn = parentOverrideId
    ? detail?.turns.find(turn => turn.id === parentOverrideId)
    : null;
  const title = conversation?.title || '新研究对话';

  return (
    <section className="chat-view">
      <header className="chat-header">
        <div className="chat-header__identity">
          <button className="icon-button chat-history-trigger" type="button" onClick={onOpenHistory} aria-label="打开对话历史">
            <PanelLeftOpen size={17} />
          </button>
          <div>
            <span className="eyebrow">全局论文对话</span>
            <h2>{title}</h2>
          </div>
        </div>
        <div className="chat-header__actions">
          {conversation && <span>{conversation.turn_count} 轮</span>}
          <button className="icon-button" type="button" onClick={onOpenHistory} title="对话历史" aria-label="打开对话历史"><History size={16} /></button>
          <button className="icon-button" type="button" onClick={onBeginNew} title="新对话" aria-label="新建对话"><Plus size={17} /></button>
        </div>
      </header>

      <div className="chat-transcript" role="log" aria-busy={busy} aria-live="off">
        <div className="chat-transcript__inner">
          {loading && !detail && <div className="chat-loading"><MessageSquareText size={20} /><span>正在恢复对话历史…</span></div>}
          {!loading && !conversation && (
            <div className="chat-welcome">
              <div className="chat-welcome__mark"><FileQuestion size={24} /></div>
              <span className="eyebrow">{readyPapers.length ? `${readyPapers.length} 篇论文已就绪` : '等待论文索引'}</span>
              <h3>{readyPapers.length ? '从论文证据中提出一个问题' : '先准备可检索的论文'}</h3>
              {readyPapers.length > 0 && (
                <div className="chat-starters">
                  {[
                    '这些论文解决了哪些共同问题？',
                    '主要方法之间有哪些关键差异？',
                    '当前证据中有哪些局限与研究空白？',
                  ].map(prompt => <button key={prompt} type="button" onClick={() => {
                    updateDraft(prompt);
                    composerRef.current?.focus();
                  }}>{prompt}</button>)}
                </div>
              )}
            </div>
          )}
          {conversation && detail && branchTurns.length === 0 && !loading && (
            <div className="chat-welcome chat-welcome--compact">
              <div className="chat-welcome__mark"><MessageSquareText size={22} /></div>
              <h3>这个对话还没有问题</h3>
            </div>
          )}
          {branchTurns.map(turn => (
            <ChatTurn
              key={turn.id}
              turn={turn}
              papers={papers}
              siblings={siblingsByTurnId.get(turn.id) || [turn]}
              stageLabel={activeJob?.turn_id === turn.id || runningTurn?.id === turn.id ? stageLabel : null}
              interactionDisabled={busy || conversation?.status === 'archived'}
              onCitation={onCitation}
              onContinue={continueFromTurn}
              onRetry={turnToRetry => void retryTurn(turnToRetry)}
              onSelectBranch={turnId => void selectBranch(turnId)}
              onSuggestedFollowUp={(sourceTurn, query) => void submitQuery(query, sourceTurn.id)}
            />
          ))}
          {error && (
            <div className="chat-error" role="alert">
              <span>{error}</span>
              <button className="text-button" type="button" onClick={() => setError(null)}>关闭</button>
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <ChatComposer
        ref={composerRef}
        draft={draft}
        readyPaperCount={readyPapers.length}
        scopePaperIds={scopePaperIds}
        parentLabel={parentTurn ? parentTurn.user_query.slice(0, 28) : null}
        stageLabel={busy ? stageLabel : null}
        busy={busy}
        archived={conversation?.status === 'archived'}
        onDraftChange={updateDraft}
        onSend={() => void submitQuery()}
        onCancel={() => void cancelTurn()}
        onOpenScope={() => setScopeOpen(true)}
        onClearParent={() => setParentOverrideId(null)}
        onOpenSources={onOpenSources}
      />

      <SourceScopeDialog
        open={scopeOpen}
        papers={readyPapers}
        selectedPaperIds={scopePaperIds}
        onApply={setScopePaperIds}
        onClose={() => setScopeOpen(false)}
      />
      <div className="visually-hidden" aria-live="polite" aria-atomic="true">{liveMessage}</div>
    </section>
  );
};

const statusForTurn = (turn: ConversationTurn): string => {
  if (turn.status === 'cancelled') return '本轮已取消';
  if (turn.status === 'failed') return turn.error_message || '回答生成失败';
  return '回答已更新';
};

export default ChatView;
