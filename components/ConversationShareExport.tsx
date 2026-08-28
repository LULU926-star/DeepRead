import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  FileText,
  LoaderCircle,
  Share2,
  Trash2,
  X,
} from 'lucide-react';
import { apiErrorMessage, deepreadApi } from '../services/deepreadApi';
import type { ExportArtifact, ShareCreateResult, ShareLink } from '../types';

type DialogKind = 'share' | 'export' | null;

interface ConversationShareExportProps {
  sessionId: string;
  conversationId: string | null;
  tipTurnId?: string | null;
  disabled?: boolean;
}

const EXPIRY_OPTIONS = [
  { value: 1, label: '1 天' },
  { value: 7, label: '7 天' },
  { value: 30, label: '30 天' },
];

const pollDelay = (milliseconds: number) => new Promise(resolve => window.setTimeout(resolve, milliseconds));

const ConversationShareExport: React.FC<ConversationShareExportProps> = ({
  sessionId,
  conversationId,
  tipTurnId,
  disabled = false,
}) => {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareResult, setShareResult] = useState<ShareCreateResult | null>(null);
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [expiry, setExpiry] = useState(7);
  const [includeSources, setIncludeSources] = useState(true);
  const [allowMarkdown, setAllowMarkdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const [exportFormat, setExportFormat] = useState<'markdown' | 'pdf'>('markdown');
  const [exportSources, setExportSources] = useState(true);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exports, setExports] = useState<ExportArtifact[]>([]);
  const [activeArtifactId, setActiveArtifactId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const loadShares = useCallback(async () => {
    if (!conversationId) return;
    try {
      setShares(await deepreadApi.listShareLinks(sessionId, conversationId));
      setShareError(null);
    } catch (error) {
      setShareError(apiErrorMessage(error));
    }
  }, [conversationId, sessionId]);

  const loadExports = useCallback(async () => {
    if (!conversationId) return;
    try {
      setExports(await deepreadApi.listExports(sessionId));
      setExportError(null);
    } catch (error) {
      setExportError(apiErrorMessage(error));
    }
  }, [conversationId, sessionId]);

  useEffect(() => {
    if (!conversationId || dialog === null) return;
    if (dialog === 'share') void loadShares();
    if (dialog === 'export') void loadExports();
    const previousFocus = document.activeElement as HTMLElement | null;
    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDialog(null);
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable: HTMLElement[] = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled)'),
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
  }, [conversationId, dialog, loadExports, loadShares]);

  const createShare = async () => {
    if (!conversationId) return;
    setShareBusy(true);
    setShareError(null);
    setShareResult(null);
    try {
      const result = await deepreadApi.createShareLink(sessionId, conversationId, {
        expires_in_days: expiry,
        include_sources: includeSources,
        allow_markdown_download: allowMarkdown,
        tip_turn_id: tipTurnId,
      });
      setShareResult(result);
      await loadShares();
    } catch (error) {
      setShareError(apiErrorMessage(error));
    } finally {
      setShareBusy(false);
    }
  };

  const copyText = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const revokeShare = async (shareId: string) => {
    if (!conversationId) return;
    setShareBusy(true);
    try {
      await deepreadApi.revokeShareLink(sessionId, conversationId, shareId);
      await loadShares();
    } catch (error) {
      setShareError(apiErrorMessage(error));
    } finally {
      setShareBusy(false);
    }
  };

  const createExport = async () => {
    if (!conversationId) return;
    setExportBusy(true);
    setExportError(null);
    setActiveArtifactId(null);
    try {
      const artifact = await deepreadApi.createExport(sessionId, {
        source_type: 'conversation',
        source_id: conversationId,
        format: exportFormat,
        tip_turn_id: tipTurnId,
        include_sources: exportSources,
      });
      setActiveArtifactId(artifact.id);
      for (let attempt = 0; attempt < 240; attempt += 1) {
        await pollDelay(800);
        const current = await deepreadApi.getExport(sessionId, artifact.id);
        if (current.status === 'completed' || current.status === 'failed') {
          await loadExports();
          if (current.status === 'failed') setExportError(current.error_message || '导出失败');
          return;
        }
      }
      setExportError('导出超时，请稍后在导出列表中查看。');
      await loadExports();
    } catch (error) {
      setExportError(apiErrorMessage(error));
    } finally {
      setExportBusy(false);
      setActiveArtifactId(null);
    }
  };

  const deleteExport = async (artifactId: string) => {
    try {
      await deepreadApi.deleteExport(sessionId, artifactId);
      await loadExports();
    } catch (error) {
      setExportError(apiErrorMessage(error));
    }
  };

  return (
    <>
      {!disabled && conversationId && (
        <>
          <button
            className="icon-button"
            type="button"
            onClick={() => { setDialog('share'); setShareResult(null); }}
            title="分享对话"
            aria-label="分享对话"
          >
            <Share2 size={15} />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => setDialog('export')}
            title="导出 Markdown / PDF"
            aria-label="导出 Markdown 或 PDF"
          >
            <Download size={15} />
          </button>
        </>
      )}

      {dialog === 'share' && conversationId && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setDialog(null);
        }}>
          <div ref={dialogRef} className="dialog-card share-export-dialog" role="dialog" aria-modal="true" aria-labelledby="share-dialog-title" tabIndex={-1}>
            <header className="dialog-card__header">
              <div>
                <span className="eyebrow">只读快照</span>
                <h2 id="share-dialog-title">分享这个对话</h2>
              </div>
              <button className="icon-button icon-button--quiet" type="button" onClick={() => setDialog(null)} aria-label="关闭分享">
                <X size={17} />
              </button>
            </header>

            <div className="share-export-body">
              <div className="form-grid">
                <label>
                  <span>有效期</span>
                  <select value={expiry} onChange={event => setExpiry(Number(event.target.value))}>
                    {EXPIRY_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={includeSources} onChange={event => setIncludeSources(event.target.checked)} />
                  <span>包含引用证据来源</span>
                </label>
                <label className="checkbox-row">
                  <input type="checkbox" checked={allowMarkdown} onChange={event => setAllowMarkdown(event.target.checked)} />
                  <span>允许下载 Markdown</span>
                </label>
              </div>

              {shareError && <p className="inline-error">{shareError}</p>}

              {shareResult ? (
                <div className="copy-field">
                  <input readOnly value={shareResult.url} onFocus={event => event.currentTarget.select()} aria-label="分享链接" />
                  <button className="button button--secondary" type="button" onClick={() => void copyText(shareResult.url)}>
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                  <a className="button button--ghost" href={shareResult.url} target="_blank" rel="noreferrer" aria-label="打开分享链接">
                    <ExternalLink size={14} />
                  </a>
                </div>
              ) : (
                <button className="button button--primary button--small" type="button" onClick={() => void createShare()} disabled={shareBusy}>
                  {shareBusy && <LoaderCircle size={14} className="is-spinning" />}
                  {shareBusy ? '正在生成' : '生成分享链接'}
                </button>
              )}

              <div className="artifact-list">
                <span className="eyebrow">现有分享链接</span>
                {shares.length === 0 && <p className="muted-line">还没有分享链接</p>}
                {shares.map(share => (
                  <div key={share.id} className="artifact-row">
                    <span>{new Date(share.created_at).toLocaleString()} · {new Date(share.expires_at).toLocaleString()} 到期</span>
                    <button className="icon-button icon-button--quiet danger-hover" type="button" onClick={() => void revokeShare(share.id)} aria-label="撤销分享链接">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <footer className="dialog-card__footer">
              <span>链接为只读、不可变快照，可随时撤销</span>
              <button className="button button--secondary" type="button" onClick={() => setDialog(null)}>关闭</button>
            </footer>
          </div>
        </div>
      )}

      {dialog === 'export' && conversationId && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget) setDialog(null);
        }}>
          <div ref={dialogRef} className="dialog-card share-export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-dialog-title" tabIndex={-1}>
            <header className="dialog-card__header">
              <div>
                <span className="eyebrow">研究交付物</span>
                <h2 id="export-dialog-title">导出对话</h2>
              </div>
              <button className="icon-button icon-button--quiet" type="button" onClick={() => setDialog(null)} aria-label="关闭导出">
                <X size={17} />
              </button>
            </header>

            <div className="share-export-body">
              <div className="format-picker">
                <button className={exportFormat === 'markdown' ? 'is-active' : ''} type="button" onClick={() => setExportFormat('markdown')}>
                  <FileText size={15} />
                  Markdown
                </button>
                <button className={exportFormat === 'pdf' ? 'is-active' : ''} type="button" onClick={() => setExportFormat('pdf')}>
                  <FileCode2 size={15} />
                  PDF
                </button>
              </div>
              <label className="checkbox-row">
                <input type="checkbox" checked={exportSources} onChange={event => setExportSources(event.target.checked)} />
                <span>包含引用证据附录</span>
              </label>

              {exportError && <p className="inline-error">{exportError}</p>}

              <button className="button button--primary button--small" type="button" onClick={() => void createExport()} disabled={exportBusy}>
                {exportBusy && <LoaderCircle size={14} className="is-spinning" />}
                {exportBusy ? '正在导出' : `导出 ${exportFormat === 'pdf' ? 'PDF' : 'Markdown'}`}
              </button>

              <div className="artifact-list">
                <span className="eyebrow">导出记录</span>
                {exports.length === 0 && <p className="muted-line">还没有导出文件</p>}
                {exports.map(artifact => (
                  <div key={artifact.id} className={`artifact-row${activeArtifactId === artifact.id ? ' is-active' : ''}`}>
                    <span className="artifact-meta">
                      <strong>{artifact.format.toUpperCase()}</strong>
                      {artifact.status === 'completed'
                        ? ` · ${Math.max(1, Math.round(artifact.size_bytes / 1024))} KB`
                        : ` · ${artifact.status}`}
                      <small>{new Date(artifact.created_at).toLocaleString()}</small>
                    </span>
                    {artifact.status === 'completed' && (
                      <a className="button button--secondary button--small" href={deepreadApi.exportDownloadUrl(sessionId, artifact.id)}>
                        <Download size={13} />下载
                      </a>
                    )}
                    <button className="icon-button icon-button--quiet danger-hover" type="button" onClick={() => void deleteExport(artifact.id)} aria-label="删除导出">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <footer className="dialog-card__footer">
              <span>导出由 DeepRead 在本地生成，不离开你的机器</span>
              <button className="button button--secondary" type="button" onClick={() => setDialog(null)}>关闭</button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
};

export default ConversationShareExport;
