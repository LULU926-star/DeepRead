import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LoaderCircle, Sparkles, X } from 'lucide-react';
import type { CrossPaperCitation, Paper, PaperSimilarity } from '../types';
import { apiErrorMessage, deepreadApi } from '../services/deepreadApi';
import CitationLink from './CitationLink';

interface SimilarViewProps {
  sessionId: string;
  papers: Paper[];
  activePaperId: string | null;
  onCitation: (citation: CrossPaperCitation) => void;
}

const SimilarView: React.FC<SimilarViewProps> = ({ sessionId, papers, activePaperId, onCitation }) => {
  const readyPapers = useMemo(() => papers.filter(paper => paper.index_status === 'ready'), [papers]);
  const [targetId, setTargetId] = useState('');
  const [results, setResults] = useState<PaperSimilarity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const paperNames = useMemo(() => new Map(papers.map(paper => [paper.paper_id, paper.metadata?.title || paper.filename])), [papers]);

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    const preferred = readyPapers.some(paper => paper.paper_id === activePaperId) ? activePaperId : readyPapers[0]?.paper_id;
    setTargetId(preferred || '');
    setResults([]);
    setError(null);
    setHasRun(false);
    setLoading(false);
  }, [activePaperId, readyPapers, sessionId]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const run = async () => {
    if (!targetId) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setResults([]);
    setHasRun(false);
    try {
      const items = await deepreadApi.findSimilar(sessionId, targetId, 3, controller.signal);
      if (requestRef.current !== controller) return;
      setResults(items);
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

  return (
    <section className="tool-view">
      <div className="action-heading">
        <div className="view-intro"><span className="eyebrow">Quick Action</span><h2>相似论文</h2><p>从当前研究语料中寻找主题和方法最接近的论文，并列出双方证据。</p></div>
        <div className="similar-controls"><label>目标论文<select value={targetId} onChange={event => { requestRef.current?.abort(); requestRef.current = null; setTargetId(event.target.value); setResults([]); setError(null); setHasRun(false); setLoading(false); }} disabled={loading}>{readyPapers.map(paper => <option value={paper.paper_id} key={paper.paper_id}>{paper.paper_id} · {paper.metadata?.title || paper.filename}</option>)}</select></label><button className={loading ? 'button button--secondary' : 'button button--primary'} type="button" onClick={loading ? cancel : run} disabled={!loading && readyPapers.length < 2}>{loading ? <X size={15} /> : <Sparkles size={15} />}{loading ? '取消等待' : '查找相似论文'}</button></div>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {!results.length && !loading && <div className="empty-state"><Sparkles size={30} /><h3>{readyPapers.length < 2 ? '需要至少两篇已索引论文' : hasRun ? '没有达到相似度阈值的论文' : '尚未查找相似论文'}</h3><p>{hasRun ? '可更换目标论文，或为当前 Session 添加更多论文。' : '选择目标论文后运行语义相似度检索。'}</p></div>}
      {loading && <div className="loading-surface"><LoaderCircle size={26} className="is-spinning" /><p>正在比较论文语义向量与证据片段…</p></div>}
      <div className="similar-list">{results.map((result, index) => {
        const targetEvidence = result.citations.filter(citation => citation.paper_id === result.target_paper_id);
        const candidateEvidence = result.citations.filter(citation => citation.paper_id === result.paper_id);
        return (
          <article className="similar-row" key={result.paper_id}>
            <div className="similar-rank">{index + 1}</div>
            <div className="similar-main">
              <header><div><span className="paper-id">{result.paper_id}</span><h3>{paperNames.get(result.paper_id) || result.paper_id}</h3></div><strong>{Math.round(result.score * 100)}%</strong></header>
              <div className="similar-score"><span style={{ width: `${Math.round(result.score * 100)}%` }} /></div>
              <p>{result.rationale}</p>
              <div className="paired-evidence"><div><span>目标论文证据</span>{targetEvidence.map(citation => <CitationLink key={citation.chunk_id} citation={citation} onOpen={onCitation} />)}</div><div><span>候选论文证据</span>{candidateEvidence.map(citation => <CitationLink key={citation.chunk_id} citation={citation} onOpen={onCitation} />)}</div></div>
            </div>
          </article>
        );
      })}</div>
    </section>
  );
};

export default SimilarView;
