import React from 'react';
import { LocateFixed } from 'lucide-react';
import type { CrossPaperCitation } from '../types';

interface CitationLinkProps {
  citation: CrossPaperCitation;
  onOpen: (citation: CrossPaperCitation) => void;
  compact?: boolean;
  available?: boolean;
}

const CitationLink: React.FC<CitationLinkProps> = ({ citation, onOpen, compact = false, available = true }) => (
  <button
    type="button"
    className={`citation-link${compact ? ' citation-link--compact' : ''}${available ? '' : ' citation-link--unavailable'}`}
    onClick={() => onOpen(citation)}
    disabled={!available}
    aria-label={available
      ? `打开 ${citation.paper_id}，${citation.section_title || citation.section}，第 ${(citation.page_index ?? 0) + 1} 页`
      : `${citation.paper_id} 原文已删除，引用快照仍保留`}
    title={available
      ? `定位到 ${citation.paper_id} 第 ${(citation.page_index ?? 0) + 1} 页`
      : `${citation.paper_id} 原文已删除`}
  >
    {!compact && <LocateFixed size={12} aria-hidden="true" />}
    <span>{citation.marker || `[${citation.paper_id}-§${citation.section}]`}</span>
  </button>
);

export default CitationLink;
