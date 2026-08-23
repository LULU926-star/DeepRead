import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, LoaderCircle, Search, X } from 'lucide-react';
import type { Chunk, CrossPaperCitation } from '../types';
import { apiErrorMessage, deepreadApi } from '../services/deepreadApi';
import CitationLink from './CitationLink';

interface SearchViewProps {
  sessionId: string;
  selectedPaperIds: string[];
  onCitation: (citation: CrossPaperCitation) => void;
}

const SearchView: React.FC<SearchViewProps> = ({ sessionId, selectedPaperIds, onCitation }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Chunk[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const requestRef = useRef<AbortController | null>(null);
  const scopeKey = selectedPaperIds.join('\u0000');

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setResults([]);
    setQuery('');
    setError(null);
    setHasSearched(false);
    setLoading(false);
  }, [sessionId, scopeKey]);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(false);
    try {
      const items = await deepreadApi.search(
        sessionId,
        query.trim(),
        selectedPaperIds,
        8,
        controller.signal,
      );
      if (requestRef.current !== controller) return;
      setResults(items);
      setHasSearched(true);
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
    <section className="tool-view search-view">
      <div className="view-intro">
        <span className="eyebrow">RAG Retrieval</span>
        <h2>跨论文证据检索</h2>
        <p>在已索引论文中查找原文证据，结果保留章节、页码与稳定引用锚点。</p>
      </div>

      <form className="search-form" onSubmit={submit}>
        <Search size={18} aria-hidden="true" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="例如：各论文如何评估长上下文推理能力？" aria-label="检索问题" />
        {loading ? (
          <button className="button button--secondary" type="button" onClick={cancel}>
            取消等待 <X size={15} />
          </button>
        ) : (
          <button className="button button--primary" type="submit" disabled={!query.trim()}>
            检索 <ArrowRight size={15} />
          </button>
        )}
      </form>

      <div className="query-scope">{selectedPaperIds.length ? `限定在已选 ${selectedPaperIds.length} 篇论文` : '检索全部已就绪论文'}</div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {loading && (
        <div className="operation-status" role="status">
          <LoaderCircle size={15} className="is-spinning" />
          <span>正在运行本地 BGE-M3 检索 · {elapsedSeconds} 秒</span>
          <small>首次加载模型通常需要 30–60 秒，后续查询会更快。</small>
        </div>
      )}

      <div className="evidence-list">
        {!loading && !error && !results.length && (
          <div className="empty-state compact">
            <Search size={25} />
            <p>{hasSearched ? '没有找到符合当前论文范围的证据，请换一种表述或调整选择。' : '输入问题后，这里会按相关度排列论文证据。'}</p>
          </div>
        )}
        {results.map((chunk, index) => (
          <article className="evidence-row" key={chunk.id}>
            <div className="evidence-rank">{String(index + 1).padStart(2, '0')}</div>
            <div className="evidence-body">
              <header>
                <span className="paper-id">{chunk.paper_id}</span>
                <strong>{chunk.section_title || chunk.section}</strong>
                <small>第 {chunk.page_index + 1} 页 · ¶{chunk.paragraph}</small>
                {chunk.score != null && <span className="score">{Math.round(chunk.score * 100)}%</span>}
              </header>
              <p>{chunk.text}</p>
              <CitationLink citation={chunk.citation} onOpen={onCitation} />
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};

export default SearchView;
