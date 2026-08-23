import React from 'react';
import { BookCopy, FileCode2, GitCompareArrows, MessageSquareText, RefreshCw, Search, Sparkles } from 'lucide-react';
import type { SessionInfo, WorkspaceView } from '../types';

interface WorkspaceHeaderProps {
  session: SessionInfo | null;
  view: WorkspaceView;
  selectedCount: number;
  readyCount: number;
  onViewChange: (view: WorkspaceView) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

const tabs: Array<{ id: WorkspaceView; label: string; icon: React.ReactNode }> = [
  { id: 'chat', label: '对话', icon: <MessageSquareText size={15} /> },
  { id: 'search', label: '检索', icon: <Search size={15} /> },
  { id: 'review', label: '综合综述', icon: <BookCopy size={15} /> },
  { id: 'compare', label: '方法对比', icon: <GitCompareArrows size={15} /> },
  { id: 'bibtex', label: 'BibTeX', icon: <FileCode2 size={15} /> },
  { id: 'similar', label: '相似论文', icon: <Sparkles size={15} /> },
];

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  session,
  view,
  selectedCount,
  readyCount,
  onViewChange,
  onRefresh,
  refreshing,
}) => (
  <header className="workspace-header">
    <div className="workspace-title">
      <div>
        <span className="eyebrow">当前研究</span>
        <h1>{session?.name || '选择或创建研究会话'}</h1>
      </div>
      {session && (
        <div className="workspace-meta">
          <span>{readyCount} 篇可检索</span>
          <span>{selectedCount ? `已选 ${selectedCount} 篇` : '默认使用全部论文'}</span>
          <button className="icon-button" type="button" onClick={onRefresh} title="刷新数据" aria-label="刷新数据">
            <RefreshCw size={16} className={refreshing ? 'is-spinning' : ''} />
          </button>
        </div>
      )}
    </div>
    <nav className="workspace-tabs" aria-label="研究工具">
      {tabs.map(tab => (
        <button
          type="button"
          key={tab.id}
          className={view === tab.id ? 'is-active' : ''}
          onClick={() => onViewChange(tab.id)}
          disabled={!session}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </button>
      ))}
    </nav>
  </header>
);

export default WorkspaceHeader;
