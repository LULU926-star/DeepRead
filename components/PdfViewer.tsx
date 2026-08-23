import React, { useMemo } from 'react';
import { AlertTriangle, ExternalLink, FileText, LocateFixed, X } from 'lucide-react';
import type { CrossPaperCitation, Paper } from '../types';
import { deepreadApi } from '../services/deepreadApi';

interface PdfViewerProps {
  sessionId: string | null;
  paper: Paper | null;
  citation: CrossPaperCitation | null;
  onClose: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ sessionId, paper, citation, onClose }) => {
  const pdfUrl = useMemo(() => {
    if (!sessionId || !paper) return '';
    const page = citation?.paper_id === paper.paper_id && citation.page_index != null
      ? citation.page_index + 1
      : 1;
    return `${deepreadApi.paperPdfUrl(sessionId, paper.paper_id)}#page=${page}&view=FitH`;
  }, [citation, paper, sessionId]);

  if (!paper || !sessionId) {
    return (
      <section className="pdf-pane pdf-pane--empty" aria-label="论文原文">
        <FileText size={32} aria-hidden="true" />
        <p>从论文库中选择一篇论文查看原文</p>
      </section>
    );
  }

  const activeCitation = citation?.paper_id === paper.paper_id ? citation : null;

  return (
    <section className="pdf-pane" aria-label={`${paper.filename} 原文`}>
      <header className="pdf-pane__header">
        <div className="pdf-pane__identity">
          <span className="paper-id">{paper.paper_id}</span>
          <div>
            <h2 title={paper.filename}>{paper.metadata?.title || paper.filename}</h2>
            <p>{paper.page_count ? `${paper.page_count} 页` : '页数读取中'}</p>
          </div>
        </div>
        <div className="icon-actions">
          {paper.pdf_available !== false && (
            <a className="icon-button" href={pdfUrl} target="_blank" rel="noreferrer" title="在新窗口打开 PDF" aria-label="在新窗口打开 PDF">
              <ExternalLink size={16} />
            </a>
          )}
          <button className="icon-button pdf-pane__close" type="button" onClick={onClose} title="关闭原文" aria-label="关闭原文">
            <X size={17} />
          </button>
        </div>
      </header>

      {activeCitation && (
        <div className="citation-locator" key={activeCitation.chunk_id}>
          <LocateFixed size={15} aria-hidden="true" />
          <div>
            <strong>{activeCitation.marker}</strong>
            <span>
              {activeCitation.section_title || activeCitation.section}
              {activeCitation.page_index != null ? ` · 第 ${activeCitation.page_index + 1} 页` : ''}
            </span>
            {activeCitation.snippet && <p>{activeCitation.snippet}</p>}
          </div>
        </div>
      )}

      {paper.pdf_available === false ? (
        <div className="pdf-unavailable" role="status">
          <AlertTriangle size={28} aria-hidden="true" />
          <h3>原始 PDF 不在托管目录中</h3>
          <p>现有索引仍可用于检索。要恢复原文跳转，请删除这条论文记录后重新上传 PDF。</p>
        </div>
      ) : (
        <iframe
          key={`${paper.paper_id}:${activeCitation?.chunk_id || 'start'}`}
          src={pdfUrl}
          title={`${paper.filename} PDF`}
          className="pdf-frame"
        />
      )}
    </section>
  );
};

export default PdfViewer;
