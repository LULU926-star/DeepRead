import React from 'react';
import type { CitationOccurrence, CrossPaperCitation } from '../types';
import CitationLink from './CitationLink';

interface CitationTextProps {
  content: string;
  citations: CrossPaperCitation[];
  occurrences?: CitationOccurrence[];
  onOpen: (citation: CrossPaperCitation) => void;
  isAvailable?: (citation: CrossPaperCitation) => boolean;
}

const CitationText: React.FC<CitationTextProps> = ({ content, citations, occurrences = [], onOpen, isAvailable }) => {
  const byChunk = new Map(citations.map(citation => [citation.chunk_id, citation]));
  const validOccurrences = [...occurrences]
    .filter(item => item.start >= 0 && item.end <= content.length && item.end > item.start && byChunk.has(item.chunk_id))
    .sort((left, right) => left.start - right.start);

  if (validOccurrences.length) {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    validOccurrences.forEach((occurrence, index) => {
      if (occurrence.start < cursor) return;
      if (occurrence.start > cursor) nodes.push(<React.Fragment key={`text-${index}`}>{content.slice(cursor, occurrence.start)}</React.Fragment>);
      const citation = byChunk.get(occurrence.chunk_id);
      if (citation) nodes.push(<CitationLink key={`${occurrence.chunk_id}-${occurrence.start}`} citation={citation} onOpen={onOpen} compact available={isAvailable?.(citation) ?? true} />);
      cursor = occurrence.end;
    });
    if (cursor < content.length) nodes.push(<React.Fragment key="tail">{content.slice(cursor)}</React.Fragment>);
    return <>{nodes}</>;
  }

  const citationQueues = new Map<string, CrossPaperCitation[]>();
  citations.forEach(citation => citationQueues.set(citation.marker, [...(citationQueues.get(citation.marker) || []), citation]));
  const parts = content.split(/(\[P\d+-§[^\]]+\])/g);
  return <>{parts.map((part, index) => {
    const queue = citationQueues.get(part);
    const citation = queue?.shift();
    return citation
      ? <CitationLink key={`${citation.chunk_id}-${index}`} citation={citation} onOpen={onOpen} compact available={isAvailable?.(citation) ?? true} />
      : <React.Fragment key={`part-${index}`}>{part}</React.Fragment>;
  })}</>;
};

export default CitationText;
