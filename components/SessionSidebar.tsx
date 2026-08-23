import React, { useMemo, useState } from 'react';
import { BookOpenText, Filter, Plus, Search, Trash2, X } from 'lucide-react';
import type { SessionInfo } from '../types';

type SessionStatusFilter = 'all' | 'with_papers' | 'with_reviews' | 'empty' | 'expiring' | 'expired';

const statusOptions: Array<{ value: SessionStatusFilter; label: string }> = [
  { value: 'all', label: '全部状态' },
  { value: 'with_papers', label: '已有论文' },
  { value: 'with_reviews', label: '已有综述' },
  { value: 'empty', label: '空会话' },
  { value: 'expiring', label: '7 天内到期' },
  { value: 'expired', label: '已过期' },
];

const expiryState = (session: SessionInfo) => {
  const derivedDays = Math.ceil((new Date(session.expires_at).getTime() - Date.now()) / 86_400_000);
  const days = session.days_until_expiry ?? derivedDays;
  return { days, expired: session.is_expired ?? days < 0 };
};

const matchesStatus = (session: SessionInfo, status: SessionStatusFilter) => {
  if (status === 'with_papers') return (session.paper_count || 0) > 0;
  if (status === 'with_reviews') return (session.review_count || 0) > 0;
  if (status === 'empty') return (session.paper_count || 0) === 0;
  const expiry = expiryState(session);
  if (status === 'expiring') return !expiry.expired && expiry.days <= 7;
  if (status === 'expired') return expiry.expired;
  return true;
};

interface SessionSidebarProps {
  sessions: SessionInfo[];
  activeSessionId: string | null;
  loading: boolean;
  onSelect: (sessionId: string) => void;
  onCreate: (name: string) => Promise<void>;
  onDelete: (session: SessionInfo) => void;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({
  sessions,
  activeSessionId,
  loading,
  onSelect,
  onCreate,
  onDelete,
}) => {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<SessionStatusFilter>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filteredSessions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return sessions.filter(session => {
      const searchableText = `${session.name || '未命名研究'} ${session.id}`.toLocaleLowerCase();
      return (!normalizedQuery || searchableText.includes(normalizedQuery))
        && matchesStatus(session, statusFilter);
    });
  }, [query, sessions, statusFilter]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onCreate(name);
      setName('');
      setCreating(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <aside className="session-sidebar" aria-label="研究会话">
      <div className="brand-lockup">
        <span className="brand-mark"><BookOpenText size={18} /></span>
        <div>
          <strong>DeepRead</strong>
          <span>Research workspace</span>
        </div>
      </div>

      <div className="sidebar-heading">
        <span>研究会话</span>
        <div className="sidebar-heading__actions">
          <button
            className="icon-button icon-button--inverse session-filter-toggle"
            type="button"
            onClick={() => { setFiltersOpen(value => !value); setCreating(false); }}
            title="搜索和筛选会话"
            aria-label="搜索和筛选会话"
            aria-expanded={filtersOpen}
          >
            <Filter size={15} />
          </button>
          <button className="icon-button icon-button--inverse" type="button" onClick={() => { setCreating(value => !value); setFiltersOpen(false); }} title="新建会话" aria-label="新建会话">
            <Plus size={16} />
          </button>
        </div>
      </div>

      {creating && (
        <form className="session-create" onSubmit={submit}>
          <label htmlFor="session-name">会话名称</label>
          <input
            id="session-name"
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="例如：长上下文模型综述"
            autoFocus
          />
          <div>
            <button className="button button--ghost button--small" type="button" onClick={() => setCreating(false)}>取消</button>
            <button className="button button--light button--small" type="submit" disabled={submitting}>
              {submitting ? '创建中' : '创建'}
            </button>
          </div>
        </form>
      )}

      <div className={`session-filters${filtersOpen ? ' is-open' : ''}`}>
        <div className="session-search">
          <Search size={13} aria-hidden="true" />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="搜索名称或 Session ID"
            aria-label="搜索会话名称或 Session ID"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} title="清除搜索" aria-label="清除会话搜索">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="session-filter-row">
          <label className="visually-hidden" htmlFor="session-status-filter">筛选会话状态</label>
          <select
            id="session-status-filter"
            value={statusFilter}
            onChange={event => setStatusFilter(event.target.value as SessionStatusFilter)}
            aria-label="筛选会话状态"
          >
            {statusOptions.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
          <span className="session-filter-count">{filteredSessions.length}/{sessions.length}</span>
        </div>
      </div>

      <nav className="session-list" aria-label="会话列表">
        {loading && <p className="sidebar-muted">正在读取会话…</p>}
        {!loading && sessions.length === 0 && <p className="sidebar-muted">还没有研究会话</p>}
        {!loading && sessions.length > 0 && filteredSessions.length === 0 && <p className="sidebar-muted">没有匹配的研究会话</p>}
        {filteredSessions.map(session => {
          const active = session.id === activeSessionId;
          return (
            <div className={`session-row${active ? ' is-active' : ''}`} key={session.id}>
              <button type="button" className="session-row__main" onClick={() => { onSelect(session.id); setFiltersOpen(false); }}>
                <span>{session.name || '未命名研究'}</span>
                <small>{session.paper_count || 0} 篇论文 · {session.review_count || 0} 份综述</small>
              </button>
              <button
                className="icon-button icon-button--quiet session-row__delete"
                type="button"
                onClick={() => onDelete(session)}
                title="删除会话"
                aria-label={`删除会话 ${session.name || ''}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          );
        })}
      </nav>

      <footer className="sidebar-footer">
        <span className="status-dot" />
        本地索引 · v1.2
      </footer>
    </aside>
  );
};

export default SessionSidebar;
