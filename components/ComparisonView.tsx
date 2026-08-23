import React, { useEffect, useMemo, useRef, useState } from 'react';
import { GitCompareArrows, LoaderCircle, X } from 'lucide-react';
import type { ComparisonField, CrossPaperCitation, MethodComparisonTable, Paper } from '../types';
import { apiErrorMessage, deepreadApi } from '../services/deepreadApi';
import CitationLink from './CitationLink';

interface ComparisonViewProps {
  sessionId: string;
  papers: Paper[];
  selectedPaperIds: string[];
  onCitation: (citation: CrossPaperCitation) => void;
}

const FieldCitations: React.FC<{ field: ComparisonField; row: MethodComparisonTable['rows'][number]; onCitation: (citation: CrossPaperCitation) => void }> = ({ field, row, onCitation }) => (
  <span className="cell-citations">
    {(row.field_citations?.[field] || []).map(citation => <CitationLink key={`${field}-${citation.chunk_id}`} citation={citation} onOpen={onCitation} compact />)}
  </span>
);

const ComparisonView: React.FC<ComparisonViewProps> = ({ sessionId, papers, selectedPaperIds, onCitation }) => {
  const [table, setTable] = useState<MethodComparisonTable | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const requestRef = useRef<AbortController | null>(null);
  const paperNames = useMemo(() => new Map(papers.map(paper => [paper.paper_id, paper.metadata?.title || paper.filename])), [papers]);
  const readyIds = papers.filter(paper => paper.index_status === 'ready').map(paper => paper.paper_id);
  const scopeIds = selectedPaperIds.length ? selectedPaperIds : readyIds;
  const scopeKey = scopeIds.join('\u0000');

  useEffect(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    setTable(null);
    setError(null);
    setHasRun(false);
    setLoading(false);
  }, [sessionId, scopeKey]);

  useEffect(() => () => requestRef.current?.abort(), []);

  const run = async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    setError(null);
    setTable(null);
    setHasRun(false);
    try {
      const result = await deepreadApi.compareMethods(sessionId, scopeIds, controller.signal);
      if (requestRef.current !== controller) return;
      setTable(result);
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
        <div className="view-intro"><span className="eyebrow">Quick Action</span><h2>方法与结果对比</h2><p>按论文对齐方法、数据集、指标和结果，单元格中的引用可直接定位原文。</p></div>
        <button className={loading ? 'button button--secondary' : 'button button--primary'} type="button" onClick={loading ? cancel : run} disabled={!loading && scopeIds.length < 2}>{loading ? <X size={15} /> : <GitCompareArrows size={15} />}{loading ? '取消等待' : `对比 ${scopeIds.length} 篇论文`}</button>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {!table && !loading && <div className="empty-state"><GitCompareArrows size={30} /><h3>{hasRun ? '没有可比较的结构化结果' : '尚未生成方法对比'}</h3><p>{hasRun ? '请调整论文范围后重试。' : '至少选择两篇已索引论文。'}</p></div>}
      {loading && <div className="loading-surface"><LoaderCircle size={26} className="is-spinning" /><p>正在检索方法、实验与结果证据…</p></div>}
      {table && table.rows.length === 0 && !loading && <div className="empty-state"><GitCompareArrows size={30} /><h3>没有可比较的结构化结果</h3><p>请调整论文范围后重试。</p></div>}
      {table && table.rows.length > 0 && !loading && (
        <div className="comparison-scroll">
          <table className="comparison-table">
            <thead><tr><th>论文</th><th>方法</th><th>数据集</th><th>评估指标</th><th>关键结果</th></tr></thead>
            <tbody>{table.rows.map(row => (
              <tr key={row.paper_id}>
                <th scope="row"><span className="paper-id">{row.paper_id}</span><strong>{paperNames.get(row.paper_id) || row.paper_id}</strong></th>
                <td><p>{row.method || '—'}</p><FieldCitations field="method" row={row} onCitation={onCitation} /></td>
                <td><ul>{row.datasets.length ? row.datasets.map(item => <li key={item}>{item}</li>) : <li>—</li>}</ul><FieldCitations field="datasets" row={row} onCitation={onCitation} /></td>
                <td><ul>{row.metrics.length ? row.metrics.map(item => <li key={item}>{item}</li>) : <li>—</li>}</ul><FieldCitations field="metrics" row={row} onCitation={onCitation} /></td>
                <td><p>{row.results || '—'}</p><FieldCitations field="results" row={row} onCitation={onCitation} /></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ComparisonView;
