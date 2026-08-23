import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import { CornerDownLeft, Files, LoaderCircle, Send, Square, X } from 'lucide-react';

interface ChatComposerProps {
  draft: string;
  readyPaperCount: number;
  scopePaperIds: string[];
  parentLabel?: string | null;
  stageLabel?: string | null;
  busy: boolean;
  archived?: boolean;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onCancel: () => void;
  onOpenScope: () => void;
  onClearParent: () => void;
  onOpenSources: () => void;
}

const ChatComposer = forwardRef<HTMLTextAreaElement, ChatComposerProps>(({
  draft,
  readyPaperCount,
  scopePaperIds,
  parentLabel,
  stageLabel,
  busy,
  archived = false,
  onDraftChange,
  onSend,
  onCancel,
  onOpenScope,
  onClearParent,
  onOpenSources,
}, forwardedRef) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(forwardedRef, () => textareaRef.current as HTMLTextAreaElement);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(168, Math.max(54, textarea.scrollHeight))}px`;
  }, [draft]);

  const canSend = Boolean(draft.trim()) && draft.length <= 4000 && readyPaperCount > 0 && !busy && !archived;
  const scopeLabel = scopePaperIds.length
    ? `${scopePaperIds.length} 篇指定论文`
    : `全部 ${readyPaperCount} 篇论文`;

  return (
    <div className="chat-composer-wrap">
      <div className="chat-composer">
        {parentLabel && (
          <div className="chat-composer__parent">
            <CornerDownLeft size={13} />
            <span>将从“{parentLabel}”继续形成新分支</span>
            <button type="button" onClick={onClearParent} aria-label="取消从此处追问"><X size={13} /></button>
          </div>
        )}
        {readyPaperCount === 0 && (
          <div className="chat-composer__notice">
            当前没有完成索引的论文。
            <button className="text-button" type="button" onClick={onOpenSources}>查看论文与索引</button>
          </div>
        )}
        {archived && <div className="chat-composer__notice">此对话已归档。恢复为活跃状态后才能继续提问。</div>}
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={event => onDraftChange(event.target.value.slice(0, 4000))}
          onKeyDown={event => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
          placeholder={readyPaperCount ? '针对当前论文提出问题，或继续追问…' : '先上传并完成至少一篇论文的索引'}
          disabled={readyPaperCount === 0 || archived}
          aria-label="研究问题"
          rows={2}
        />
        <div className="chat-composer__footer">
          <button className="scope-trigger" type="button" onClick={onOpenScope} disabled={!readyPaperCount || busy}>
            <Files size={14} />
            <span>{scopeLabel}</span>
          </button>
          <div className="chat-composer__actions">
            <span className={draft.length > 3800 ? 'is-warning' : ''}>{draft.length}/4000</span>
            <small><kbd>⌘</kbd>/<kbd>Ctrl</kbd> + <kbd>Enter</kbd></small>
            {busy ? (
              <button className="button button--secondary button--small" type="button" onClick={onCancel}>
                {stageLabel ? <LoaderCircle size={14} className="is-spinning" /> : <Square size={12} />}
                {stageLabel || '取消'}
              </button>
            ) : (
              <button className="button button--primary button--small" type="button" onClick={onSend} disabled={!canSend}>
                <Send size={14} />发送
              </button>
            )}
          </div>
        </div>
      </div>
      <p className="chat-composer__privacy">回答只使用本轮检索到的论文证据；问题、有限历史与证据片段可能发送给已配置的模型服务。</p>
    </div>
  );
});

ChatComposer.displayName = 'ChatComposer';

export default ChatComposer;
