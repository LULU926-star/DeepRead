import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Download, FileCode2, LoaderCircle, X } from 'lucide-react';
import type { BibtexResult, Paper } from '../types';
import { apiErrorMessage, deepreadApi } from '../services/deepreadApi';

interface BibtexViewProps {
  sessionId: string;
  papers: Paper[];
  selectedPaperIds: string[];
}

const BibtexView: React.FC<BibtexViewProps> = ({ sessionId, papers, selectedPaperIds }) => {
  const [result, setResult] = useState<BibtexResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const availableIds = papers.filter(paper => paper.parse_status === 'success').map(paper => paper.paper_id);
  const scopeIds = selectedPaperIds.length ? selectedPaperIds : availableIds;
  const scopeKey = scopeIds.join('\u0000');

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setResult(null);
    setError(null);
    setHasRun(false);
    setLoading(false);
  }, [sessionId, scopeKey]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const generate = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setResult(null);
    setHasRun(false);
    try {
      const generated = await deepreadApi.generateBibtex(sessionId, scopeIds, controller.signal);
      if (requestRef.current !== controller) return;
      setResult(generated);
      setHasRun(true);
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError' && requestRef.current === controller) {
        setError(apiErrorMessage(requestError));
      }
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  };

  const cancel = () => {
    requestRef.current?.abort();
    requestRef.current = null;
    setLoading(false);
  };

  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setError('浏览器未允许复制，请手动选择文本。');
    }
  };

  const download = () => {
    if (!result) return;
    const href = URL.createObjectURL(new Blob([result.content], { type: 'application/x-bibtex;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = 'deepread-references.bib';
    anchor.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="tool-view">
      <div className="action-heading">
        <div className="view-intro"><span className="eyebrow">Quick Action</span><h2>BibTeX 文献条目</h2><p>依据 PDF 元数据生成确定性条目，可直接复制或下载为 `.bib` 文件。</p></div>
        <button className={loading ? 'button button--secondary' : 'button button--primary'} type="button" onClick={loading ? cancel : generate} disabled={!loading && scopeIds.length < 1}>{loading ? <X size={15} /> : <FileCode2 size={15} />}{loading ? '取消等待' : `生成 ${scopeIds.length} 条`}</button>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {!result && !loading && <div className="empty-state"><FileCode2 size={30} /><h3>{hasRun ? '没有可生成的 BibTeX 条目' : '尚未生成 BibTeX'}</h3><p>{hasRun ? '请检查论文元数据或调整选择范围。' : '解析完成的论文无需向量索引即可生成。'}</p></div>}
      {loading && <div className="loading-surface"><LoaderCircle size={26} className="is-spinning" /><p>正在整理文献元数据…</p></div>}
      {result && result.entries.length === 0 && !loading && <div className="empty-state"><FileCode2 size={30} /><h3>没有可生成的 BibTeX 条目</h3><p>请检查论文元数据或调整选择范围。</p></div>}
      {result && result.entries.length > 0 && !loading && (
        <div className="bibtex-surface">
          <header><span>{result.entries.length} 条文献</span><div><button className="button button--secondary button--small" type="button" onClick={copy}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? '已复制' : '复制'}</button><button className="button button--secondary button--small" type="button" onClick={download}><Download size={14} />下载</button></div></header>
          <pre><code>{result.content}</code></pre>
        </div>
      )}
    </section>
  );
};

export default BibtexView;
