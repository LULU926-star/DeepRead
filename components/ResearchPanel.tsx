import React from 'react';
import type { Conversation, CrossPaperCitation, Paper, WorkspaceView } from '../types';
import BibtexView from './BibtexView';
import ChatView from './ChatView';
import ComparisonView from './ComparisonView';
import ReviewView from './ReviewView';
import SearchView from './SearchView';
import SimilarView from './SimilarView';

interface ResearchPanelProps {
  view: WorkspaceView;
  sessionId: string;
  papers: Paper[];
  selectedPaperIds: string[];
  activePaperId: string | null;
  activeConversation: Conversation | null;
  onCitation: (citation: CrossPaperCitation) => void;
  onConversationCreated: (conversation: Conversation) => void;
  onConversationUpdated: (conversation: Conversation) => void;
  onBeginNewConversation: () => void;
  onOpenConversationHistory: () => void;
  onOpenSources: () => void;
}

const ResearchPanel: React.FC<ResearchPanelProps> = ({
  view,
  sessionId,
  papers,
  selectedPaperIds,
  activePaperId,
  activeConversation,
  onCitation,
  onConversationCreated,
  onConversationUpdated,
  onBeginNewConversation,
  onOpenConversationHistory,
  onOpenSources,
}) => {
  if (view === 'chat') return (
    <ChatView
      sessionId={sessionId}
      conversation={activeConversation}
      papers={papers}
      initialSelectedPaperIds={selectedPaperIds}
      onConversationCreated={onConversationCreated}
      onConversationUpdated={onConversationUpdated}
      onBeginNew={onBeginNewConversation}
      onOpenHistory={onOpenConversationHistory}
      onOpenSources={onOpenSources}
      onCitation={onCitation}
    />
  );
  if (view === 'search') return <SearchView sessionId={sessionId} selectedPaperIds={selectedPaperIds} onCitation={onCitation} />;
  if (view === 'review') return <ReviewView sessionId={sessionId} papers={papers} selectedPaperIds={selectedPaperIds} onCitation={onCitation} />;
  if (view === 'compare') return <ComparisonView sessionId={sessionId} papers={papers} selectedPaperIds={selectedPaperIds} onCitation={onCitation} />;
  if (view === 'bibtex') return <BibtexView sessionId={sessionId} papers={papers} selectedPaperIds={selectedPaperIds} />;
  return <SimilarView sessionId={sessionId} papers={papers} activePaperId={activePaperId} onCitation={onCitation} />;
};

export default ResearchPanel;
