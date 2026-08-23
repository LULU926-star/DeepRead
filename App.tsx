import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import ConversationContextPane, { type ContextPaneMode } from './components/ConversationContextPane';
import EmptyWorkspace from './components/EmptyWorkspace';
import PaperPane from './components/PaperPane';
import PdfViewer from './components/PdfViewer';
import ResearchPanel from './components/ResearchPanel';
import SessionSidebar from './components/SessionSidebar';
import WorkspaceHeader from './components/WorkspaceHeader';
import { apiErrorMessage, deepreadApi } from './services/deepreadApi';
import type { Conversation, CrossPaperCitation, Paper, SessionInfo, UploadQueueItem, WorkspaceView } from './types';

const pause = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));
const activeConversationStorageKey = (sessionId: string) => `deepread.activeConversation.${sessionId}`;

const App: React.FC = () => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(() => localStorage.getItem('deepread.activeSession'));
  const [papers, setPapers] = useState<Paper[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<CrossPaperCitation | null>(null);
  const [view, setView] = useState<WorkspaceView>('chat');
  const [contextMode, setContextMode] = useState<ContextPaneMode>('conversations');
  const [conversationContextOpen, setConversationContextOpen] = useState(false);
  const [uploads, setUploads] = useState<UploadQueueItem[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);

  const activeSession = useMemo(
    () => sessions.find(session => session.id === activeSessionId) || null,
    [activeSessionId, sessions],
  );
  const activePaper = useMemo(
    () => papers.find(paper => paper.paper_id === activePaperId) || null,
    [activePaperId, papers],
  );
  const activeConversation = useMemo(
    () => conversations.find(conversation => conversation.id === activeConversationId) || null,
    [activeConversationId, conversations],
  );
  const readyPapers = useMemo(() => papers.filter(paper => paper.index_status === 'ready'), [papers]);
  const selectedIds = useMemo(() => Array.from(selectedPaperIds).filter(id => papers.some(paper => paper.paper_id === id && paper.index_status === 'ready')), [papers, selectedPaperIds]);

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const selectSession = useCallback((sessionId: string | null) => {
    activeSessionIdRef.current = sessionId;
    setActiveSessionId(sessionId);
  }, []);

  const applyPapers = useCallback((items: Paper[]) => {
    setPapers(items);
    setSelectedPaperIds(previous => new Set(Array.from(previous).filter(id => items.some(item => item.paper_id === id && item.index_status === 'ready'))));
    setActivePaperId(previous => items.some(item => item.paper_id === previous) ? previous : items[0]?.paper_id || null);
  }, []);

  const loadSessions = useCallback(async (preferredId?: string | null) => {
    setLoadingSessions(true);
    try {
      const items = await deepreadApi.listSessions();
      setSessions(items);
      const requested = preferredId ?? activeSessionId;
      const nextId = items.some(item => item.id === requested) ? requested : items[0]?.id || null;
      selectSession(nextId);
      if (nextId) localStorage.setItem('deepread.activeSession', nextId);
      else localStorage.removeItem('deepread.activeSession');
      setGlobalError(null);
    } catch (error) {
      setGlobalError(`无法连接 DeepRead 后端：${apiErrorMessage(error)}`);
    } finally {
      setLoadingSessions(false);
    }
  }, [activeSessionId, selectSession]);

  const loadPapers = useCallback(async (sessionId: string) => {
    try {
      const items = await deepreadApi.listPapers(sessionId);
      if (activeSessionIdRef.current !== sessionId) return;
      applyPapers(items);
      setGlobalError(null);
    } catch (error) {
      if (activeSessionIdRef.current !== sessionId) return;
      setGlobalError(apiErrorMessage(error));
      setPapers([]);
    }
  }, [applyPapers]);

  const loadConversations = useCallback(async (sessionId: string) => {
    setLoadingConversations(true);
    try {
      const items = await deepreadApi.listConversations(sessionId, true);
      if (activeSessionIdRef.current !== sessionId) return;
      setConversations(items);
      const storedId = localStorage.getItem(activeConversationStorageKey(sessionId));
      const nextId = items.some(item => item.id === storedId)
        ? storedId
        : items.find(item => item.status === 'active')?.id || null;
      setActiveConversationId(nextId);
      if (nextId) localStorage.setItem(activeConversationStorageKey(sessionId), nextId);
      else localStorage.removeItem(activeConversationStorageKey(sessionId));
    } catch (error) {
      if (activeSessionIdRef.current !== sessionId) return;
      setConversations([]);
      setActiveConversationId(null);
      setGlobalError(`无法恢复对话历史：${apiErrorMessage(error)}`);
    } finally {
      if (activeSessionIdRef.current === sessionId) setLoadingConversations(false);
    }
  }, []);

  const refreshWorkspace = useCallback(async (sessionId = activeSessionIdRef.current) => {
    if (!sessionId) return;
    setRefreshing(true);
    try {
      const [sessionItems, paperItems, conversationItems] = await Promise.all([
        deepreadApi.listSessions(),
        deepreadApi.listPapers(sessionId),
        deepreadApi.listConversations(sessionId, true),
      ]);
      setSessions(sessionItems);
      if (activeSessionIdRef.current === sessionId) {
        applyPapers(paperItems);
        setConversations(conversationItems);
        setActiveConversationId(previous => conversationItems.some(item => item.id === previous)
          ? previous
          : conversationItems.find(item => item.status === 'active')?.id || null);
        setGlobalError(null);
      }
    } catch (error) {
      if (activeSessionIdRef.current === sessionId) setGlobalError(apiErrorMessage(error));
    } finally {
      setRefreshing(false);
    }
  }, [applyPapers]);

  useEffect(() => { void loadSessions(); }, []);

  useEffect(() => {
    if (!activeSessionId) {
      setPapers([]);
      setConversations([]);
      setActiveConversationId(null);
      setActivePaperId(null);
      setPdfOpen(false);
      return;
    }
    localStorage.setItem('deepread.activeSession', activeSessionId);
    setPapers([]);
    setConversations([]);
    setActiveConversationId(null);
    setActivePaperId(null);
    setUploads([]);
    setSelectedPaperIds(new Set());
    setActiveCitation(null);
    setPdfOpen(false);
    setContextMode('conversations');
    setConversationContextOpen(false);
    void Promise.all([loadPapers(activeSessionId), loadConversations(activeSessionId)]);
  }, [activeSessionId, loadConversations, loadPapers]);

  const createSession = async (name: string) => {
    try {
      const created = await deepreadApi.createSession(name);
      await loadSessions(created.id);
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
      throw error;
    }
  };

  const deleteSession = async (session: SessionInfo) => {
    if (!window.confirm(`删除研究会话“${session.name || '未命名研究'}”？论文文件、索引和综述都会一并删除。`)) return;
    try {
      await deepreadApi.deleteSession(session.id);
      await loadSessions(session.id === activeSessionId ? null : activeSessionId);
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
    }
  };

  const updateUpload = (id: string, patch: Partial<UploadQueueItem>) => {
    setUploads(items => items.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const waitForJob = async (jobId: string, uploadId?: string) => {
    for (let attempt = 0; attempt < 3600; attempt += 1) {
      try {
        const progress = await deepreadApi.getProgress(jobId);
        if (uploadId) updateUpload(uploadId, {
          status: progress.status === 'failed' ? 'failed' : progress.status === 'completed' ? 'completed' : 'processing',
          progress: Math.max(0, Math.min(1, progress.progress)),
          stage: progress.stage,
          message: progress.error || progress.message,
        });
        if (progress.status === 'failed') throw new Error(progress.error || progress.message || '处理失败');
        if (progress.status === 'completed') return;
      } catch (error) {
        throw error;
      }
      await pause(900);
    }
    throw new Error('任务等待超时，请刷新论文状态。');
  };

  const processUpload = async (sessionId: string, item: UploadQueueItem) => {
    if (!item.file.name.toLowerCase().endsWith('.pdf')) {
      updateUpload(item.id, { status: 'failed', message: '仅支持 PDF 文件' });
      return;
    }
    updateUpload(item.id, { status: 'uploading', progress: 0.08, message: '正在上传' });
    try {
      const result = await deepreadApi.uploadPaper(sessionId, item.file);
      updateUpload(item.id, { status: 'processing', progress: 0.25, jobId: result.job_id, paperId: result.paper_id, message: '等待解析与索引' });
      await waitForJob(result.job_id, item.id);
      updateUpload(item.id, { status: 'completed', progress: 1, message: '解析与索引完成' });
    } catch (error) {
      updateUpload(item.id, { status: 'failed', message: apiErrorMessage(error) });
    }
  };

  const uploadFiles = (files: File[]) => {
    if (!activeSessionId || !files.length) return;
    const remaining = Math.max(0, 10 - papers.length - uploads.filter(item => !['completed', 'failed'].includes(item.status)).length);
    const accepted = files.slice(0, remaining).map(file => ({
      id: crypto.randomUUID(),
      file,
      status: 'queued' as const,
      progress: 0,
      message: '等待上传',
    }));
    if (accepted.length < files.length) setGlobalError(`每个会话最多 10 篇论文，本次仅接收 ${accepted.length} 篇。`);
    setUploads(items => [...accepted, ...items]);
    const uploadSessionId = activeSessionId;
    void Promise.allSettled(accepted.map(item => processUpload(uploadSessionId, item))).then(() => refreshWorkspace(uploadSessionId));
  };

  const togglePaper = (paperId: string) => {
    setSelectedPaperIds(previous => {
      const next = new Set(previous);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  };

  const toggleAllReady = () => {
    setSelectedPaperIds(previous => readyPapers.every(paper => previous.has(paper.paper_id))
      ? new Set()
      : new Set(readyPapers.map(paper => paper.paper_id)));
  };

  const openPaper = (paperId: string) => {
    setActivePaperId(paperId);
    setActiveCitation(null);
    setPdfOpen(true);
  };

  const openCitation = (citation: CrossPaperCitation) => {
    setActivePaperId(citation.paper_id);
    setActiveCitation(citation);
    setPdfOpen(true);
  };

  const retryPaper = async (paper: Paper) => {
    if (!activeSessionId) return;
    try {
      setPapers(items => items.map(item => item.paper_id === paper.paper_id ? { ...item, parse_status: paper.parse_status === 'failed' ? 'parsing' : item.parse_status, index_status: 'indexing' } : item));
      const result = paper.parse_status !== 'success'
        ? await deepreadApi.retryPaper(activeSessionId, paper.paper_id)
        : await deepreadApi.indexPaper(activeSessionId, paper.paper_id);
      if (result.job_id) await waitForJob(result.job_id);
      await refreshWorkspace();
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
      await refreshWorkspace();
    }
  };

  const deletePaper = async (paper: Paper) => {
    if (!activeSessionId || !window.confirm(`从本会话删除 ${paper.paper_id} · ${paper.filename}？`)) return;
    try {
      await deepreadApi.deletePaper(activeSessionId, paper.paper_id);
      if (activePaperId === paper.paper_id) {
        setActiveCitation(null);
        setPdfOpen(false);
      }
      await refreshWorkspace(activeSessionId);
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
    }
  };

  const upsertConversation = useCallback((conversation: Conversation) => {
    setConversations(items => {
      const next = items.some(item => item.id === conversation.id)
        ? items.map(item => item.id === conversation.id ? conversation : item)
        : [conversation, ...items];
      return next.sort((left, right) => Date.parse(right.updated_at) - Date.parse(left.updated_at));
    });
  }, []);

  const handleConversationCreated = useCallback((conversation: Conversation) => {
    upsertConversation(conversation);
    setActiveConversationId(conversation.id);
    localStorage.setItem(activeConversationStorageKey(conversation.session_id), conversation.id);
    setSessions(items => items.map(session => session.id === conversation.session_id
      ? { ...session, conversation_count: (session.conversation_count || 0) + 1 }
      : session));
  }, [upsertConversation]);

  const handleConversationUpdated = useCallback((conversation: Conversation) => {
    upsertConversation(conversation);
  }, [upsertConversation]);

  const beginNewConversation = useCallback(() => {
    if (activeSessionId) localStorage.removeItem(activeConversationStorageKey(activeSessionId));
    setActiveConversationId(null);
    setView('chat');
    setContextMode('conversations');
  }, [activeSessionId]);

  const selectConversation = useCallback((conversationId: string) => {
    if (!activeSessionId) return;
    setActiveConversationId(conversationId);
    localStorage.setItem(activeConversationStorageKey(activeSessionId), conversationId);
    setView('chat');
    setConversationContextOpen(false);
  }, [activeSessionId]);

  const renameConversation = async (conversation: Conversation, title: string) => {
    try {
      const updated = await deepreadApi.updateConversation(conversation.session_id, conversation.id, { title });
      upsertConversation(updated);
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
      throw error;
    }
  };

  const toggleConversationArchive = async (conversation: Conversation) => {
    try {
      const updated = await deepreadApi.updateConversation(conversation.session_id, conversation.id, {
        status: conversation.status === 'archived' ? 'active' : 'archived',
      });
      upsertConversation(updated);
      if (updated.status === 'archived' && activeConversationId === updated.id) beginNewConversation();
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
      throw error;
    }
  };

  const deleteConversation = async (conversation: Conversation) => {
    if (!window.confirm(`删除对话“${conversation.title}”？历史问题、回答和分支都会一并删除。`)) return;
    try {
      await deepreadApi.deleteConversation(conversation.session_id, conversation.id);
      setConversations(items => items.filter(item => item.id !== conversation.id));
      setSessions(items => items.map(session => session.id === conversation.session_id
        ? { ...session, conversation_count: Math.max(0, (session.conversation_count || 1) - 1) }
        : session));
      if (activeConversationId === conversation.id) beginNewConversation();
    } catch (error) {
      setGlobalError(apiErrorMessage(error));
      throw error;
    }
  };

  const showPaperContext = useCallback(() => {
    setContextMode('papers');
    setConversationContextOpen(true);
  }, []);

  const changeView = useCallback((nextView: WorkspaceView) => {
    setView(nextView);
    if (nextView === 'chat') setContextMode('conversations');
    else setConversationContextOpen(false);
  }, []);

  const paperPane = (
    <PaperPane
      papers={papers}
      selectedPaperIds={selectedPaperIds}
      activePaperId={activePaperId}
      uploads={uploads}
      onFiles={uploadFiles}
      onToggle={togglePaper}
      onToggleAllReady={toggleAllReady}
      onActivate={openPaper}
      onRetry={retryPaper}
      onReindex={retryPaper}
      onDelete={deletePaper}
      onClearUpload={id => setUploads(items => items.filter(item => item.id !== id))}
    />
  );

  return (
    <div className="app-shell">
      <SessionSidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        loading={loadingSessions}
        onSelect={selectSession}
        onCreate={createSession}
        onDelete={deleteSession}
      />
      <main className="app-main">
        <WorkspaceHeader
          session={activeSession}
          view={view}
          selectedCount={selectedIds.length}
          readyCount={readyPapers.length}
          onViewChange={changeView}
          onRefresh={refreshWorkspace}
          refreshing={refreshing}
        />
        {globalError && <div className="global-error" role="alert"><AlertTriangle size={15} /><span>{globalError}</span><button className="icon-button icon-button--quiet" type="button" onClick={() => setGlobalError(null)} aria-label="关闭错误"><X size={14} /></button></div>}
        {!activeSessionId ? (
          <EmptyWorkspace onCreate={() => void createSession('')} />
        ) : (
          <div className={`workspace-body${view === 'chat' ? ' workspace-body--chat' : ''}`}>
            {view === 'chat' ? (
              <ConversationContextPane
                conversations={conversations}
                activeConversationId={activeConversationId}
                loading={loadingConversations}
                mode={contextMode}
                mobileOpen={conversationContextOpen}
                paperPane={paperPane}
                onModeChange={setContextMode}
                onSelect={selectConversation}
                onNew={beginNewConversation}
                onRename={renameConversation}
                onToggleArchive={toggleConversationArchive}
                onDelete={deleteConversation}
                onCloseMobile={() => setConversationContextOpen(false)}
              />
            ) : paperPane}
            {view === 'chat' && conversationContextOpen && (
              <button className="context-backdrop" type="button" onClick={() => setConversationContextOpen(false)} aria-label="关闭上下文面板" />
            )}
            <div className="research-split">
              <div className="research-pane">
                <ResearchPanel
                  key={activeSessionId}
                  view={view}
                  sessionId={activeSessionId}
                  papers={papers}
                  selectedPaperIds={selectedIds}
                  activePaperId={activePaperId}
                  activeConversation={activeConversation}
                  onCitation={openCitation}
                  onConversationCreated={handleConversationCreated}
                  onConversationUpdated={handleConversationUpdated}
                  onBeginNewConversation={beginNewConversation}
                  onOpenConversationHistory={() => {
                    setContextMode('conversations');
                    setConversationContextOpen(true);
                  }}
                  onOpenSources={showPaperContext}
                />
              </div>
              <div className={`pdf-shell${pdfOpen ? ' is-open' : ''}`}>
                <PdfViewer sessionId={activeSessionId} paper={activePaper} citation={activeCitation} onClose={() => setPdfOpen(false)} />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
