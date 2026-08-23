import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Files, X } from 'lucide-react';
import type { Paper } from '../types';

interface SourceScopeDialogProps {
  open: boolean;
  papers: Paper[];
  selectedPaperIds: string[];
  onApply: (paperIds: string[]) => void;
  onClose: () => void;
}

const SourceScopeDialog: React.FC<SourceScopeDialogProps> = ({
  open,
  papers,
  selectedPaperIds,
  onApply,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const [mode, setMode] = useState<'all' | 'selected'>(selectedPaperIds.length ? 'selected' : 'all');
  const [draftIds, setDraftIds] = useState<Set<string>>(new Set(selectedPaperIds));

  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    setMode(selectedPaperIds.length ? 'selected' : 'all');
    setDraftIds(new Set(selectedPaperIds));
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)'),
      ) as HTMLElement[];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, [open]);

  const allIds = useMemo(() => papers.map(paper => paper.paper_id), [papers]);
  const selectedCount = mode === 'all' ? allIds.length : draftIds.size;

  if (!open) return null;

  const togglePaper = (paperId: string) => {
    setMode('selected');
    setDraftIds(previous => {
      const next = new Set(previous);
      if (next.has(paperId)) next.delete(paperId);
      else next.add(paperId);
      return next;
    });
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        ref={dialogRef}
        className="dialog-card source-scope-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-scope-title"
        tabIndex={-1}
      >
        <header className="dialog-card__header">
          <div>
            <span className="eyebrow">本轮证据边界</span>
            <h2 id="source-scope-title">选择检索论文</h2>
          </div>
          <button className="icon-button icon-button--quiet" type="button" onClick={onClose} aria-label="关闭论文范围">
            <X size={17} />
          </button>
        </header>

        <div className="scope-choice-list">
          <button
            className={`scope-choice${mode === 'all' ? ' is-active' : ''}`}
            type="button"
            onClick={() => setMode('all')}
          >
            <span className="scope-choice__check">{mode === 'all' && <Check size={14} />}</span>
            <span>
              <strong>全部可检索论文</strong>
              <small>本轮使用 {allIds.length} 篇 ready 且未跳过的论文</small>
            </span>
          </button>

          <div className={`scope-choice scope-choice--papers${mode === 'selected' ? ' is-active' : ''}`}>
            <div className="scope-choice__heading">
              <span className="scope-choice__check">{mode === 'selected' && <Check size={14} />}</span>
              <span>
                <strong>指定论文</strong>
                <small>缩小当前 turn 的检索范围</small>
              </span>
            </div>
            <div className="scope-paper-list">
              {papers.map(paper => (
                <label key={paper.paper_id}>
                  <input
                    type="checkbox"
                    checked={draftIds.has(paper.paper_id)}
                    onChange={() => togglePaper(paper.paper_id)}
                  />
                  <span className="paper-id">{paper.paper_id}</span>
                  <span>{paper.metadata?.title || paper.filename}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <p className="dialog-note"><Files size={14} />论文范围会固化在本轮回答中，之后修改默认范围不会改变历史证据。</p>
        <footer className="dialog-card__footer">
          <span>{selectedCount} 篇论文</span>
          <div>
            <button className="button button--secondary" type="button" onClick={onClose}>取消</button>
            <button
              className="button button--primary"
              type="button"
              disabled={mode === 'selected' && !draftIds.size}
              onClick={() => {
                onApply(mode === 'all' ? [] : Array.from(draftIds));
                onClose();
              }}
            >
              应用范围
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default SourceScopeDialog;
