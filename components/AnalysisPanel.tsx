import React from 'react';
import { AnalysisResult, IntentMode, Language } from '../types';
import IntentBar from './IntentBar';
import { Activity, FileText, User, HelpCircle, MapPin, Target, Brain, Microscope, BookOpen, AlertCircle, ArrowRight, Languages, MessageCircleQuestion, Lightbulb, BarChart } from 'lucide-react';

interface AnalysisPanelProps {
  mode: IntentMode;
  setMode: (mode: IntentMode) => void;
  data: AnalysisResult | null;
  loading: boolean;
  onCitationClick: (id: number) => void;
  language: Language;
  onLanguageToggle: () => void;
}

const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ 
  mode, 
  setMode, 
  data, 
  loading,
  onCitationClick,
  language,
  onLanguageToggle
}) => {
  
  // Helper to render text with clickable citation badges
  const renderTextWithCitations = (text: string) => {
    const parts = text.split(/(\[\d+\])/g);
    return parts.map((part, index) => {
      const match = part.match(/\[(\d+)\]/);
      if (match) {
        const id = parseInt(match[1]);
        return (
          <button
            key={index}
            onClick={() => onCitationClick(id)}
            className="inline-flex items-center justify-center ml-1 align-baseline text-[10px] font-bold text-academic-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 hover:bg-academic-600 hover:text-white transition-colors cursor-pointer transform hover:scale-110"
            title="Locate in text"
          >
            {id}
          </button>
        );
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getIconForCoreLogic = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('background') || l.includes('背景')) return <BookOpen size={16} className="text-gray-500" />;
    if (l.includes('problem') || l.includes('问题')) return <Target size={16} className="text-red-500" />;
    if (l.includes('method') || l.includes('方法')) return <Microscope size={16} className="text-purple-500" />;
    if (l.includes('result') || l.includes('结果')) return <BarChart size={16} className="text-blue-500" />;
    if (l.includes('conclusion') || l.includes('结论')) return <Lightbulb size={16} className="text-amber-500" />;
    return <FileText size={16} className="text-academic-600" />; // Default
  };

  const renderContent = () => {
    // Safety check if data is incomplete during partial updates
    if (!data) return null;

    if (mode === IntentMode.SKIM) {
      return (
        <>
            {/* Component A: Infobox (Stats) */}
            <div className="grid grid-cols-3 gap-3">
              {data.stats.slice(0, 3).map((stat, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center">
                  <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{stat.label}</span>
                  <span className="text-lg font-bold text-slate-900 mt-1">{stat.value}</span>
                </div>
              ))}
            </div>

            {/* Component B: Overview */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <FileText size={16} className="text-gray-400" />
                {language === 'zh' ? '概览' : 'Overview'}
              </h3>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100">
                <p className="font-serif text-slate-700 leading-relaxed text-[15px]">
                  {renderTextWithCitations(data.overview)}
                </p>
              </div>
            </section>

            {/* Component C: Core Logic (BPMRC) */}
            <section>
               <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Target size={16} className="text-gray-400" />
                {language === 'zh' ? '核心逻辑 (BPMRC)' : 'Core Logic (BPMRC)'}
              </h3>
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden divide-y divide-gray-50">
                {data.coreLogic.map((item, idx) => (
                  <div key={idx} className="p-4 flex gap-4 hover:bg-gray-50 transition-colors">
                    <div className="mt-1 flex-shrink-0 bg-gray-50 p-1.5 rounded-md h-fit">
                       {getIconForCoreLogic(item.label)}
                    </div>
                    <div>
                      <span className="text-xs font-bold text-gray-500 uppercase tracking-wide block mb-1">
                        {item.label}
                      </span>
                      <p className="text-sm text-slate-800 leading-snug">
                        {item.content}
                        {item.citationId && (
                           <button
                             onClick={() => onCitationClick(item.citationId!)}
                             className="inline-flex items-center justify-center ml-2 text-[10px] font-bold text-academic-600 bg-blue-50 border border-blue-100 rounded px-1.5 py-0.5 hover:bg-academic-600 hover:text-white transition-colors"
                           >
                             {item.citationId}
                           </button>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
        </>
      );
    }

    if (mode === IntentMode.LEARN) {
      return (
          <>
            {/* ELI5 Section */}
            <section className="bg-gradient-to-br from-indigo-50 to-blue-50 p-5 rounded-xl border border-indigo-100">
              <h3 className="text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                <Brain size={16} className="text-indigo-500" />
                {language === 'zh' ? '通俗解释 (ELI5)' : "ELI5 (Explain Like I'm 5)"}
              </h3>
              <p className="text-sm text-indigo-800 leading-relaxed font-medium">
                {data.eli5}
              </p>
            </section>

            {/* Glossary Section */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <BookOpen size={16} className="text-gray-400" />
                {language === 'zh' ? '智能术语表' : 'Smart Glossary'}
              </h3>
              <div className="grid grid-cols-1 gap-3">
                {data.glossary.map((item, idx) => (
                  <div key={idx} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <span className="text-xs font-bold text-academic-600 bg-blue-50 px-2 py-1 rounded mb-2 inline-block">
                      {item.term}
                    </span>
                    <p className="text-sm text-slate-600 leading-snug">
                      {item.definition}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
      );
    }

    if (mode === IntentMode.DEEP_DIVE) {
      return (
          <>
            {/* Methodology Critique */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Microscope size={16} className="text-gray-400" />
                {language === 'zh' ? '方法论批判' : 'Methodology Critique'}
              </h3>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-l-4 border-l-academic-600">
                <p className="text-sm text-slate-700 leading-relaxed">
                  {data.deepDive.methodologyCritique}
                </p>
              </div>
            </section>

            {/* Q&A Section (New) */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <MessageCircleQuestion size={16} className="text-violet-500" />
                {language === 'zh' ? '深度问答 (AI 预测)' : 'Deep Q&A (AI Predicted)'}
              </h3>
              <div className="space-y-3">
                {data.deepDive.qAndA?.map((qa, idx) => (
                   <div key={idx} className="bg-violet-50/50 rounded-lg p-4 border border-violet-100">
                      <h4 className="text-sm font-bold text-violet-900 mb-2 flex gap-2">
                        <span className="text-violet-400">Q:</span>
                        {qa.question}
                      </h4>
                      <p className="text-sm text-slate-700 leading-snug pl-5 border-l-2 border-violet-200">
                        {qa.answer}
                      </p>
                   </div>
                ))}
              </div>
            </section>

            {/* Limitations */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-500" />
                {language === 'zh' ? '局限性' : 'Noted Limitations'}
              </h3>
              <ul className="space-y-2">
                {data.deepDive.limitations.map((lim, idx) => (
                  <li key={idx} className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 text-sm text-slate-700 flex gap-2 items-start">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0"></span>
                    {lim}
                  </li>
                ))}
              </ul>
            </section>

            {/* Future Research */}
            <section>
              <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                <ArrowRight size={16} className="text-green-500" />
                {language === 'zh' ? '未来研究方向' : 'Future Research Directions'}
              </h3>
               <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {data.deepDive.futureResearch.map((item, idx) => (
                  <div key={idx} className="p-3 border-b border-gray-50 last:border-0 text-sm text-slate-600 hover:bg-gray-50">
                    {item}
                  </div>
                ))}
              </div>
            </section>
          </>
      );
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#F9FAFB] border-l border-gray-200">
      
      {/* 1. Header with Intent Bar */}
      <div className="p-4 border-b border-gray-100 bg-white/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold text-gray-400 tracking-wider uppercase flex items-center gap-2">
            <Activity size={14} /> AI Copilot
          </h2>
          {/* Language Toggle */}
          <button 
            onClick={onLanguageToggle}
            disabled={!data || loading}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-gray-100 transition-colors text-[10px] font-bold text-slate-600 disabled:opacity-30 border border-gray-200"
            title="Toggle Language"
          >
            <Languages size={12} />
            <span className={language === 'en' ? 'text-academic-600' : 'text-gray-400'}>EN</span>
            <span className="text-gray-300">/</span>
            <span className={language === 'zh' ? 'text-academic-600' : 'text-gray-400'}>中</span>
          </button>
        </div>
        
        <IntentBar currentMode={mode} onModeChange={setMode} />
      </div>

      {/* 2. Content Stream */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar scroll-smooth">
        
        {loading ? (
          // Skeleton Loading State
          <div className="space-y-6 animate-pulse">
            <div className="flex gap-4">
               {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-lg flex-1"></div>)}
            </div>
            <div className="h-40 bg-gray-200 rounded-lg"></div>
            <div className="space-y-3">
               {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-200 rounded-lg"></div>)}
            </div>
             {/* Translation Loading Text */}
            {data && (
              <div className="text-center text-xs text-gray-400 font-medium">
                 Translating content...
              </div>
            )}
          </div>
        ) : !data ? (
          <div className="text-center text-gray-400 mt-20">
            <FileText size={48} className="mx-auto mb-4 opacity-20" />
            <p>Upload a PDF to start analysis</p>
          </div>
        ) : (
          renderContent()
        )}
        
        {/* Footer info */}
        <div className="pt-8 pb-4 text-center">
             <p className="text-[10px] text-gray-300 font-medium">POWERED BY GEMINI 2.5</p>
        </div>
      </div>
    </div>
  );
};

export default AnalysisPanel;