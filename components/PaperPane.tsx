import React, { useMemo, useRef } from 'react';
import { AlertTriangle, Check, CircleDashed, FileText, LoaderCircle, RotateCcw, Trash2, Upload, X } from 'lucide-react';
import type { Paper, UploadQueueItem } from '../types';

interface PaperPaneProps {
  papers: Paper[];
  selectedPaperIds: Set<string>;
  activePaperId: string | null;
  uploads: UploadQueueItem[];
  onFiles: (files: File[]) => void;
  onToggle: (paperId: string) => void;
  onToggleAllReady: () => void;
  onActivate: (paperId: string) => void;
  onRetry: (paper: Paper) => void;
  onReindex: (paper: Paper) => void;
  onDelete: (paper: Paper) => void;
  onClearUpload: (uploadId: string) => void;
}

const formatBytes = (bytes: number) => {
  if (!bytes) return '—';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const statusFor = (paper: Paper) => {
  if (paper.parse_status === 'failed') return { label: '解析失败', tone: 'error', icon: <AlertTriangle size={13} /> };
  if (paper.parse_status === 'pending') return { label: '等待解析', tone: 'muted', icon: <CircleDashed size={13} /> };
  if (paper.parse_status === 'parsing') return { label: '解析中', tone: 'progress', icon: <LoaderCircle size={13} className="is-spinning" /> };
  if (paper.index_status === 'indexing') return { label: '索引中', tone: 'progress', icon: <LoaderCircle size={13} className="is-spinning" /> };
  if (paper.index_status === 'failed') return { label: '索引失败', tone: 'warning', icon: <AlertTriangle size={13} /> };
  if (paper.index_status === 'ready') return { label: `${paper.chunk_count} 段已索引`, tone: 'ready', icon: <Check size={13} /> };
  return { label: '待索引', tone: 'muted', icon: <CircleDashed size={13} /> };
};

const PaperPane: React.FC<PaperPaneProps> = ({
  papers,
  selectedPaperIds,
  activePaperId,
  uploads,
  onFiles,
  onToggle,
  onToggleAllReady,
  onActivate,
  onRetry,
  onReindex,
  onDelete,
  onClearUpload,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const readyPapers = useMemo(() => papers.filter(paper => paper.index_status === 'ready'), [papers]);

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.length) onFiles(Array.from(event.target.files));
    event.target.value = '';
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    const droppedFiles = Array.from<File>(event.dataTransfer.files);
    onFiles(droppedFiles.filter(file => file.name.toLowerCase().endsWith('.pdf')));
  };

  return (
    <aside className="paper-pane" aria-label="论文库">
      <div className="paper-pane__header">
        <div>
          <span className="eyebrow">Corpus</span>
          <h2>论文库 <small>{papers.length}/10</small></h2>
        </div>
        <button className="icon-button" type="button" onClick={() => inputRef.current?.click()} title="添加 PDF" aria-label="添加 PDF">
          <Upload size={16} />
        </button>
        <input ref={inputRef} className="visually-hidden" type="file" accept="application/pdf,.pdf" multiple onChange={handleInput} />
      </div>

      <label className="dropzone" onDragOver={event => event.preventDefault()} onDrop={handleDrop}>
        <Upload size={16} aria-hidden="true" />
        <span>拖入 PDF，或点击选择多篇</span>
        <input type="file" accept="application/pdf,.pdf" multiple onChange={handleInput} />
      </label>

      {uploads.length > 0 && (
        <div className="upload-queue" aria-live="polite">
          <div className="section-label"><span>上传队列</span><span>{uploads.filter(item => item.status === 'completed').length}/{uploads.length}</span></div>
          {uploads.map(upload => (
            <div className="upload-row" key={upload.id}>
              <div className="upload-row__icon"><FileText size={14} /></div>
              <div className="upload-row__body">
                <strong title={upload.file.name}>{upload.file.name}</strong>
                <span>{upload.status === 'failed' ? upload.message : upload.message || upload.stage || upload.status}</span>
                <div className="progress-track"><span style={{ width: `${Math.round(upload.progress * 100)}%` }} /></div>
              </div>
              {(upload.status === 'completed' || upload.status === 'failed') && (
                <button className="icon-button icon-button--quiet" type="button" onClick={() => onClearUpload(upload.id)} title="移除记录" aria-label="移除上传记录">
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="paper-list__tools">
        <span className="section-label">本次研究</span>
        <button type="button" className="text-button" onClick={onToggleAllReady}>
          {readyPapers.length && readyPapers.every(paper => selectedPaperIds.has(paper.paper_id)) ? '清除选择' : '全选可用'}
        </button>
      </div>

      <div className="paper-list">
        {papers.length === 0 && <div className="paper-empty"><FileText size={26} /><p>上传论文后开始建立索引</p></div>}
        {papers.map(paper => {
          const status = statusFor(paper);
          const active = paper.paper_id === activePaperId;
          const selected = selectedPaperIds.has(paper.paper_id);
          return (
            <article className={`paper-row${active ? ' is-active' : ''}${selected ? ' is-selected' : ''}`} key={paper.paper_id}>
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(paper.paper_id)}
                aria-label={`选择 ${paper.filename}`}
                disabled={paper.index_status !== 'ready'}
              />
              <button type="button" className="paper-row__main" onClick={() => onActivate(paper.paper_id)}>
                <div className="paper-row__title"><span className="paper-id">{paper.paper_id}</span><strong title={paper.filename}>{paper.metadata?.title || paper.filename}</strong></div>
                <span className="paper-row__meta">{paper.metadata?.authors || '作者信息待解析'} · {paper.page_count || '—'} 页 · {formatBytes(paper.size_bytes)}</span>
                <span className={`paper-status paper-status--${status.tone}`}>{status.icon}{status.label}</span>
                {(paper.parse_error || paper.index_error) && <span className="paper-row__error" title={paper.parse_error || paper.index_error || ''}>{paper.parse_error || paper.index_error}</span>}
              </button>
              <div className="paper-row__actions">
                {['pending', 'failed'].includes(paper.parse_status) && <button className="icon-button icon-button--quiet" type="button" onClick={() => onRetry(paper)} title={paper.parse_status === 'pending' ? '继续解析' : '重新解析'} aria-label={`${paper.parse_status === 'pending' ? '继续解析' : '重新解析'} ${paper.filename}`}><RotateCcw size={13} /></button>}
                {paper.parse_status === 'success' && paper.index_status !== 'ready' && <button className="icon-button icon-button--quiet" type="button" onClick={() => onReindex(paper)} title="建立索引" aria-label={`建立 ${paper.filename} 索引`}><CircleDashed size={13} /></button>}
                <button className="icon-button icon-button--quiet danger-hover" type="button" onClick={() => onDelete(paper)} title="删除论文" aria-label={`删除 ${paper.filename}`}><Trash2 size={13} /></button>
              </div>
            </article>
          );
        })}
      </div>
    </aside>
  );
};

export default PaperPane;
