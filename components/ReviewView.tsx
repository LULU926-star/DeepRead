import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BookOpenText, ChevronRight, LoaderCircle, Plus, X } from 'lucide-react';
import type { CrossPaperCitation, Paper, Review, ReviewAngle } from '../types';
import { apiErrorMessage, deepreadApi } from '../services/deepreadApi';
import MarkdownContent from './MarkdownContent';

interface ReviewViewProps {
  sessionId: string;
  papers: Paper[];
  selectedPaperIds: string[];
  onCitation: (citation: CrossPaperCitation) => void;
}

const angleLabels: Record<ReviewAngle, string> = {
  method_comparison: '方法比较',
  timeline: '时间演进',
  limitations: '局限与争议',
  applications: '应用场景',
  custom: '自定义问题',
};

const ReviewView: React.FC<ReviewViewProps> = ({ sessionId, papers, selectedPaperIds, onCitation }) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [angle, setAngle] = useState<ReviewAngle>('method_comparison');
  const [customPrompt, setCustomPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const generationRef = useRef<AbortController | null>(null);
  const paperNames = useMemo(() => new Map(papers.map(paper => [paper.paper_id, paper.metadata?.title || paper.filename])), [papers]);
  const readyIds = papers.filter(paper => paper.index_status === 'ready').map(paper => paper.paper_id);
  const scopeIds = selectedPaperIds.length ? selectedPaperIds : readyIds;

  useEffect(() => {
    const controller = new AbortController();
    setReviews([]);
    setActiveReview(null);
    setError(null);
    setNotice(null);
    setHistoryLoading(true);
    deepreadApi.listReviews(sessionId, controller.signal)
      .then(items => {
        setReviews(items);
        setActiveReview(items[0] || null);
      })
      .catch(requestError => {
        if ((requestError as Error).name !== 'AbortError') setError(apiErrorMessage(requestError));
      })
      .finally(() => {
        if (!controller.signal.aborted) setHistoryLoading(false);
      });
    return () => controller.abort();
  }, [sessionId]);

  useEffect(() => () => generationRef.current?.abort(), [sessionId]);

  useEffect(() => {
    if (!loading) return undefined;
    setElapsedSeconds(0);
    const timer = window.setInterval(() => setElapsedSeconds(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [loading]);

  const generate = async () => {
    if (scopeIds.length < 2) return;
    generationRef.current?.abort();
    const controller = new AbortController();
    generationRef.current = controller;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const review = await deepreadApi.generateReview(sessionId, {
        angle,
        paper_ids: scopeIds,
        custom_prompt: angle === 'custom' ? customPrompt.trim() : undefined,
      }, controller.signal);
      if (generationRef.current !== controller) return;
      setReviews(items => [review, ...items.filter(item => item.id !== review.id)]);
      setActiveReview(review);
    } catch (requestError) {
      if ((requestError as Error).name !== 'AbortError' && generationRef.current === controller) {
        setError(apiErrorMessage(requestError));
      }
    } finally {
      if (generationRef.current === controller) {
        generationRef.current = null;
        setLoading(false);
      }
    }
  };

  const cancel = () => {
    generationRef.current?.abort();
    generationRef.current = null;
    setLoading(false);
    setNotice('已停止等待本次综述。若后端已经进入生成阶段，完成结果会保存在历史综述中。');
  };

  return (
    <section className="tool-view review-view">
      <div className="review-toolbar">
        <div className="view-intro">
          <span className="eyebrow">Map–Reduce Review</span>
          <h2>综合综述</h2>
          <p>从多篇论文提炼主题，再以原文证据合并为结构化综述。</p>
        </div>
        <div className="review-controls">
          <label>综述角度<select value={angle} onChange={event => setAngle(event.target.value as ReviewAngle)}>{Object.entries(angleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {angle === 'custom' && <label className="review-custom">研究问题<input value={customPrompt} onChange={event => setCustomPrompt(event.target.value)} placeholder="输入需要综合回答的问题" /></label>}
          <button className={loading ? 'button button--secondary' : 'button button--primary'} type="button" onClick={loading ? cancel : generate} disabled={!loading && (scopeIds.length < 2 || (angle === 'custom' && !customPrompt.trim()))}>
            {loading ? <X size={15} /> : <Plus size={15} />}
            {loading ? '取消等待' : '生成新综述'}
          </button>
          <small>{scopeIds.length < 2 ? '至少需要 2 篇已索引论文' : `将综合 ${scopeIds.length} 篇论文`}</small>
        </div>
      </div>
      {error && <div className="inline-error" role="alert">{error}</div>}
      {notice && <div className="inline-notice" role="status">{notice}</div>}

      <div className="review-layout">
        <aside className="review-history" aria-label="综述历史">
          <div className="section-label">历史综述</div>
          {historyLoading && <p className="muted-line">读取中…</p>}
          {!historyLoading && !reviews.length && <p className="muted-line">暂无综述</p>}
          {reviews.map(review => (
            <button type="button" key={review.id} className={activeReview?.id === review.id ? 'is-active' : ''} onClick={() => setActiveReview(review)}>
              <span>{angleLabels[review.angle]}</span>
              <small>{new Date(review.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · {review.paper_ids.length} 篇</small>
              <ChevronRight size={14} />
            </button>
          ))}
        </aside>

        <article className="review-document">
          {!activeReview && !loading && <div className="empty-state"><BookOpenText size={30} /><h3>尚未生成综合综述</h3><p>选择至少两篇已索引论文，并从上方指定综述角度。</p></div>}
          {loading && <div className="review-generating"><LoaderCircle size={26} className="is-spinning" /><strong>正在运行 Map–Reduce · {elapsedSeconds} 秒</strong><p>提取主题、逐篇归纳并合并引用证据，可能需要几分钟。</p></div>}
          {activeReview && !loading && (
            <>
              <header className="review-document__header">
                <div><span className="eyebrow">{angleLabels[activeReview.angle]}</span><h2>{activeReview.themes[0] || '跨论文综合综述'}</h2></div>
                <dl><div><dt>论文</dt><dd>{activeReview.paper_ids.length}</dd></div><div><dt>引用</dt><dd>{activeReview.citations.length}</dd></div><div><dt>Tokens</dt><dd>{activeReview.tokens_used ?? '—'}</dd></div><div><dt>模型</dt><dd>{activeReview.model || '—'}</dd></div></dl>
              </header>
              {activeReview.themes.length > 0 && <div className="theme-strip">{activeReview.themes.map(theme => <span key={theme}>{theme}</span>)}</div>}
              {activeReview.sections.map((section, index) => (
                <section className="review-section" key={`${section.title}-${index}`}>
                  <span className="section-number">{String(index + 1).padStart(2, '0')}</span>
                  <div><h3>{section.title}</h3><MarkdownContent content={section.content} citations={section.citations} occurrences={section.citation_occurrences} onCitation={onCitation} /></div>
                </section>
              ))}
              <footer className="review-sources"><strong>覆盖论文</strong>{activeReview.paper_ids.map(id => <span key={id}><b>{id}</b>{paperNames.get(id) || id}</span>)}</footer>
            </>
          )}
        </article>
      </div>
    </section>
  );
};

export default ReviewView;
