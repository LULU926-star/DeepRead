import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  Check,
  FileStack,
  MessageSquareText,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { Conversation } from '../types';

export type ContextPaneMode = 'conversations' | 'papers';

interface ConversationContextPaneProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
  mode: ContextPaneMode;
  mobileOpen: boolean;
  paperPane: React.ReactNode;
  onModeChange: (mode: ContextPaneMode) => void;
  onSelect: (conversationId: string) => void;
  onNew: () => void;
  onRename: (conversation: Conversation, title: string) => Promise<void>;
  onToggleArchive: (conversation: Conversation) => Promise<void>;
  onDelete: (conversation: Conversation) => Promise<void>;
  onCloseMobile: () => void;
}

const formatUpdatedAt = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '刚刚更新';
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return '刚刚更新';
  if (minutes < 60) return `${minutes} 分钟前`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} 小时前`;
  return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric' }).format(new Date(timestamp));
};

const ConversationContextPane: React.FC<ConversationContextPaneProps> = ({
  conversations,
  activeConversationId,
  loading,
  mode,
  mobileOpen,
  paperPane,
  onModeChange,
  onSelect,
  onNew,
  onRename,
  onToggleArchive,
  onDelete,
  onCloseMobile,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const activeConversations = useMemo(
    () => conversations.filter(conversation => conversation.status === 'active'),
    [conversations],
  );
  const archivedConversations = useMemo(
    () => conversations.filter(conversation => conversation.status === 'archived'),
    [conversations],
  );

  const run = async (conversationId: string, action: () => Promise<void>) => {
    setPendingId(conversationId);
    try {
      await action();
    } finally {
      setPendingId(null);
    }
  };

  const renderConversation = (conversation: Conversation) => {
    const editing = editingId === conversation.id;
    const pending = pendingId === conversation.id;
    return (
      <div
        className={`conversation-row${activeConversationId === conversation.id ? ' is-active' : ''}${conversation.status === 'archived' ? ' is-archived' : ''}`}
        key={conversation.id}
      >
        {editing ? (
          <form className="conversation-row__edit" onSubmit={event => {
            event.preventDefault();
            const nextTitle = editingTitle.trim();
            if (!nextTitle) return;
            void run(conversation.id, async () => {
              await onRename(conversation, nextTitle);
              setEditingId(null);
            });
          }}>
            <input
              value={editingTitle}
              onChange={event => setEditingTitle(event.target.value.slice(0, 200))}
              autoFocus
              aria-label="对话标题"
            />
            <button type="submit" aria-label="保存标题" disabled={!editingTitle.trim() || pending}><Check size={14} /></button>
            <button type="button" aria-label="取消重命名" onClick={() => setEditingId(null)}><X size={14} /></button>
          </form>
        ) : (
          <>
            <button className="conversation-row__main" type="button" onClick={() => {
              onSelect(conversation.id);
              onCloseMobile();
            }}>
              <span>{conversation.title}</span>
              <small>{conversation.turn_count} 轮 · {formatUpdatedAt(conversation.updated_at)}</small>
            </button>
            <div className="conversation-row__actions">
              <button type="button" disabled={pending} onClick={() => {
                setEditingId(conversation.id);
                setEditingTitle(conversation.title);
              }} aria-label={`重命名 ${conversation.title}`}><Pencil size={13} /></button>
              <button
                type="button"
                disabled={pending}
                onClick={() => void run(conversation.id, () => onToggleArchive(conversation))}
                aria-label={conversation.status === 'archived' ? `恢复 ${conversation.title}` : `归档 ${conversation.title}`}
              >
                {conversation.status === 'archived' ? <ArchiveRestore size={13} /> : <Archive size={13} />}
              </button>
              <button
                type="button"
                className="danger-hover"
                disabled={pending}
                onClick={() => void run(conversation.id, () => onDelete(conversation))}
                aria-label={`删除 ${conversation.title}`}
              ><Trash2 size={13} /></button>
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <aside className={`context-pane${mobileOpen ? ' is-open' : ''}`} aria-label="研究上下文">
      <header className="context-pane__header">
        <div className="context-segments" aria-label="上下文类型">
          <button
            className={mode === 'conversations' ? 'is-active' : ''}
            type="button"
            onClick={() => onModeChange('conversations')}
          ><MessageSquareText size={14} />对话</button>
          <button
            className={mode === 'papers' ? 'is-active' : ''}
            type="button"
            onClick={() => onModeChange('papers')}
          ><FileStack size={14} />论文</button>
        </div>
        <button className="icon-button icon-button--quiet context-pane__close" type="button" onClick={onCloseMobile} aria-label="关闭上下文面板"><X size={16} /></button>
      </header>

      {mode === 'papers' ? (
        <div className="context-pane__paper">{paperPane}</div>
      ) : (
        <div className="conversation-history">
          <div className="conversation-history__toolbar">
            <div>
              <span className="section-label">研究对话</span>
              <small>{activeConversations.length} 个活跃对话</small>
            </div>
            <button className="button button--primary button--small" type="button" onClick={() => {
              onNew();
              onCloseMobile();
            }}><Plus size={14} />新对话</button>
          </div>

          <div className="conversation-list">
            {loading && <p className="muted-line">正在恢复对话历史…</p>}
            {!loading && activeConversations.length === 0 && (
              <div className="conversation-empty">
                <MessageSquareText size={21} />
                <strong>从一个研究问题开始</strong>
                <p>首次发送时才创建对话，不会留下空白历史。</p>
              </div>
            )}
            {activeConversations.map(renderConversation)}
          </div>

          {archivedConversations.length > 0 && (
            <details className="archived-conversations">
              <summary>已归档 · {archivedConversations.length}</summary>
              <div>{archivedConversations.map(renderConversation)}</div>
            </details>
          )}
        </div>
      )}
    </aside>
  );
};

export default ConversationContextPane;
