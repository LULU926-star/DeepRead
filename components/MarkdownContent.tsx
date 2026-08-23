import React from 'react';
import type { CitationOccurrence, CrossPaperCitation } from '../types';
import CitationText from './CitationText';

interface MarkdownContentProps {
  content: string;
  citations: CrossPaperCitation[];
  occurrences?: CitationOccurrence[];
  onCitation: (citation: CrossPaperCitation) => void;
  isCitationAvailable?: (citation: CrossPaperCitation) => boolean;
}

type BlockKind = 'heading' | 'paragraph' | 'unordered' | 'ordered' | 'quote';

interface MarkdownBlock {
  kind: BlockKind;
  text: string;
  offset: number;
  level?: number;
  ordinal?: string;
}

const parseBlocks = (content: string): MarkdownBlock[] => {
  const blocks: MarkdownBlock[] = [];
  let offset = 0;
  content.split('\n').forEach(line => {
    const lineOffset = offset;
    offset += line.length + 1;
    if (!line.trim()) return;

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: 'heading', text: heading[2], offset: lineOffset + heading[1].length + 1, level: heading[1].length });
      return;
    }
    const unordered = line.match(/^\s*[-*+]\s+(.*)$/);
    if (unordered) {
      blocks.push({ kind: 'unordered', text: unordered[1], offset: lineOffset + line.indexOf(unordered[1]) });
      return;
    }
    const ordered = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (ordered) {
      blocks.push({ kind: 'ordered', text: ordered[2], offset: lineOffset + line.indexOf(ordered[2]), ordinal: ordered[1] });
      return;
    }
    const quote = line.match(/^\s*>\s?(.*)$/);
    if (quote) {
      blocks.push({ kind: 'quote', text: quote[1], offset: lineOffset + line.indexOf(quote[1]) });
      return;
    }
    blocks.push({ kind: 'paragraph', text: line, offset: lineOffset });
  });
  return blocks;
};

const MarkdownContent: React.FC<MarkdownContentProps> = ({ content, citations, occurrences = [], onCitation, isCitationAvailable }) => {
  const blocks = parseBlocks(content);

  const renderInline = (block: MarkdownBlock) => {
    const end = block.offset + block.text.length;
    const localOccurrences = occurrences
      .filter(item => item.start >= block.offset && item.end <= end)
      .map(item => ({ ...item, start: item.start - block.offset, end: item.end - block.offset }));
    return <CitationText content={block.text} citations={citations} occurrences={localOccurrences} onOpen={onCitation} isAvailable={isCitationAvailable} />;
  };

  return (
    <div className="markdown-content">
      {blocks.map(block => {
        if (block.kind === 'heading') return <h4 className={`markdown-heading markdown-heading--${block.level}`} key={block.offset}>{renderInline(block)}</h4>;
        if (block.kind === 'unordered') return <div className="markdown-list-item" key={block.offset}><span aria-hidden="true">•</span><p>{renderInline(block)}</p></div>;
        if (block.kind === 'ordered') return <div className="markdown-list-item" key={block.offset}><span>{block.ordinal}.</span><p>{renderInline(block)}</p></div>;
        if (block.kind === 'quote') return <blockquote key={block.offset}>{renderInline(block)}</blockquote>;
        return <p key={block.offset}>{renderInline(block)}</p>;
      })}
    </div>
  );
};

export default MarkdownContent;
