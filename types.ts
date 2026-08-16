export enum IntentMode {
  SKIM = 'SKIM',
  LEARN = 'LEARN',
  DEEP_DIVE = 'DEEP_DIVE'
}

export type Language = 'en' | 'zh';

export interface Citation {
  id: number;
  snippet: string; // The text to highlight
}

export interface CoreLogicItem {
  label: string; // Background, Problem, Method, Result, Conclusion
  content: string;
  citationId?: number;
}

export interface GlossaryItem {
  term: string;
  definition: string;
}

export interface QAItem {
  question: string;
  answer: string;
}

export interface DeepDiveData {
  methodologyCritique: string;
  limitations: string[];
  futureResearch: string[];
  qAndA: QAItem[];
}

export interface AnalysisResult {
  // Gatekeeper fields
  isValidResearchContent: boolean;
  rejectionReason?: string;

  // Skim Mode
  stats: Array<{ label: string; value: string }>;
  overview: string; // HTML or Markdown string with [1] markers
  coreLogic: CoreLogicItem[]; // Replaces fiveWs (BPMRC)
  citations: Citation[];
  
  // Learn Mode
  glossary: GlossaryItem[];
  eli5: string; // Explain Like I'm 5

  // Deep Dive Mode
  deepDive: DeepDiveData;
}

export interface AppState {
  file: File | null;
  fileUrl: string | null;
  isProcessing: boolean;
  analysis: AnalysisResult | null;
  translatedAnalysis: AnalysisResult | null; // Cache for the Chinese version
  language: Language;
  mode: IntentMode;
  error: string | null;
  rejectionReason: string | null; // UI state for Gatekeeper rejection
}