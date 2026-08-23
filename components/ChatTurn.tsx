import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronRight,
  Clipboard,
  CornerDownRight,
  FileWarning,
  LoaderCircle,
  RefreshCcw,
  Sparkles,
} from 'lucide-react';
import type { ConversationTurn, CrossPaperCitation, Paper } from '../types';
import CitationLink from './CitationLink';
import MarkdownContent from './MarkdownContent';
import QueryRewriteDisclosure from './QueryRewriteDisclosure';

interface ChatTurnProps {
  turn: ConversationTurn;
  papers: Paper[];
  siblings: ConversationTurn[];
  stageLabel?: string | null;
  interactionDisabled?: boolean;
  onCitation: (citation: CrossPaperCitation) => void;
  onContinue: (turn: ConversationTurn, draft?: string) => void;
  onRetry: (turn: ConversationTurn) => void;
  onSelectBranch: (turnId: string) => void;
  onSuggestedFollowUp: (turn: ConversationTurn, query: string) => void;
}

const runningStatuses = new Set<ConversationTurn['status']>([
  'queued',
  'rewriting',
  'retrieving',
  'generating',
  'validating',
]);

const statusLabel: Record<ConversationTurn['status'], string> = {
  queued: '问题已进入队列',
  rewriting: '正在判断上下文并改写检索问题',
  retrieving: '正在跨论文检索证据',
  generating: '正在依据证据撰写回答',
  validating: '正在校验引用与证据范围',
  completed: '回答完成',
  failed: '回答生成失败',
  cancelled: '本轮已取消',
};

const ChatTurn: React.FC<ChatTurnProps> = ({
  turn,
  papers,
  siblings,
  stageLabel,
  interactionDisabled = false,
  onCitation,
  onContinue,
  onRetry,
  onSelectBranch,
  onSuggestedFollowUp,
}) => {
  const [copied, setCopied] = useState(false);
  const availablePaperIds = useMemo(() => new Set(papers.map(paper => paper.paper_id)), [papers]);
  const uniqueCitations = useMemo(() => {
    const seen = new Set<string>();
    return turn.citations.filter(citation => {
      if (seen.has(citation.chunk_id)) return false;
      seen.add(citation.chunk_id);
      return true;
    });
  }, [turn.citations]);
  const isRunning = runningStatuses.has(turn.status);

  const copyAnswer = async () => {
    const text = turn.answer_markdown || turn.user_query;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <article className={`chat-turn chat-turn--${turn.status}`} data-turn-id={turn.id}>
      <div className="chat-turn__question">
        <div className="chat-turn__number">{String(turn.sequence).padStart(2, '0')}</div>
        <div>
          <span>你的问题</span>
          <p>{turn.user_query}</p>
        </div>
        {siblings.length > 1 && (
          <label className="branch-selector">
            <span className="visually-hidden">选择同级分支</span>
            <select value={turn.id} onChange={event => onSelectBranch(event.target.value)}>
              {siblings.map((sibling, index) => (
                <option key={sibling.id} value={sibling.id}>分支 {index + 1} · {sibling.status}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {(turn.rewritten_query || turn.status !== 'queued') && <QueryRewriteDisclosure turn={turn} />}

      <div className="chat-turn__answer">
        <div className="chat-turn__answer-mark" aria-hidden="true"><Sparkles size={15} /></div>
        <div className="chat-turn__answer-body">
          {isRunning ? (
            <div className="chat-stage" role="status">
              <LoaderCircle size={17} className="is-spinning" />
              <div>
                <strong>{stageLabel || statusLabel[turn.status]}</strong>
                <p>当前问题和已检索证据已持久化，离开页面后仍可恢复。</p>
              </div>
            </div>
          ) : turn.status === 'completed' ? (
            turn.answer_markdown ? (
              <MarkdownContent
                content={turn.answer_markdown}
                citations={turn.citations}
                occurrences={turn.citation_occurrences}
                onCitation={onCitation}
                isCitationAvailable={citation => availablePaperIds.has(citation.paper_id)}
              />
            ) : (
              <p className="chat-evidence-empty">在当前论文范围内未找到足够证据。</p>
            )
          ) : (
            <div className="chat-turn__failure" role="alert">
              <AlertCircle size={17} />
              <div>
                <strong>{statusLabel[turn.status]}</strong>
                <p>{turn.error_message || (turn.status === 'cancelled' ? '问题和历史已保留，可以随时重新执行。' : '本轮没有覆盖任何历史回答。')}</p>
                {turn.error_code && <code>{turn.error_code}</code>}
              </div>
            </div>
          )}

          {!isRunning && uniqueCitations.length > 0 && (
            <div className="chat-turn__sources">
              <span>本轮证据</span>
              <div>
                {uniqueCitations.map(citation => {
                  const available = availablePaperIds.has(citation.paper_id);
                  return available ? (
                    <CitationLink key={citation.chunk_id} citation={citation} onOpen={onCitation} />
                  ) : (
                    <span className="deleted-source" key={citation.chunk_id} title={citation.snippet || ''}>
                      <FileWarning size={12} />{citation.marker} · 原文已删除
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {!isRunning && (
            <div className="chat-turn__tools">
              <button type="button" onClick={copyAnswer}>
                {copied ? <Check size={13} /> : <Clipboard size={13} />}{copied ? '已复制' : '复制'}
              </button>
              <button type="button" onClick={() => onContinue(turn)} disabled={interactionDisabled}>
                <CornerDownRight size={13} />继续追问
              </button>
              <button type="button" onClick={() => onRetry(turn)} disabled={interactionDisabled}>
                <RefreshCcw size={13} />重试
              </button>
              {(turn.status === 'failed' || turn.status === 'cancelled') && (
                <button type="button" onClick={() => onContinue(turn, turn.user_query)} disabled={interactionDisabled}>
                  编辑后重试<ChevronRight size={13} />
                </button>
              )}
            </div>
          )}

          {turn.status === 'completed' && turn.suggested_follow_ups.length > 0 && (
            <div className="chat-follow-ups">
              <span>继续研究</span>
              {turn.suggested_follow_ups.slice(0, 3).map(question => (
                <button
                  type="button"
                  key={question}
                  disabled={interactionDisabled}
                  onClick={() => onSuggestedFollowUp(turn, question)}
                >
                  {question}<ChevronRight size={13} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};

export default ChatTurn;
