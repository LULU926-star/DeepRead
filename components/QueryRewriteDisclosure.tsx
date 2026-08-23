import React from 'react';
import { Braces, ChevronDown, Route } from 'lucide-react';
import type { ConversationTurn } from '../types';

interface QueryRewriteDisclosureProps {
  turn: ConversationTurn;
}

const modeLabel: Record<ConversationTurn['rewrite_mode'], string> = {
  original: '原问题直接检索',
  llm: '已结合上下文改写',
  fallback: '改写回退',
};

const QueryRewriteDisclosure: React.FC<QueryRewriteDisclosureProps> = ({ turn }) => {
  const actualQuery = turn.rewritten_query || turn.user_query;

  return (
    <details className={`query-rewrite query-rewrite--${turn.rewrite_mode}`}>
      <summary>
        <Route size={13} />
        <span className="query-rewrite__mode">{modeLabel[turn.rewrite_mode]}</span>
        <span className="query-rewrite__preview">{actualQuery}</span>
        <ChevronDown size={13} className="query-rewrite__chevron" />
      </summary>
      <div className="query-rewrite__body">
        <div>
          <span>用户问题</span>
          <p>{turn.user_query}</p>
        </div>
        <div>
          <span>实际检索问题</span>
          <p>{actualQuery}</p>
        </div>
        <div className="query-rewrite__scope">
          <span>冻结论文范围</span>
          <p>{turn.scope_paper_ids.length ? turn.scope_paper_ids.join(' · ') : '当前全部可检索论文'}</p>
        </div>
        {turn.rewrite_mode === 'fallback' && (
          <p className="query-rewrite__warning"><Braces size={13} />结构化改写不可用，系统已使用确定性上下文拼接继续检索。</p>
        )}
      </div>
    </details>
  );
};

export default QueryRewriteDisclosure;
