import React, { useState } from 'react';
import Landing from './components/Landing';
import PdfViewer from './components/PdfViewer';
import AnalysisPanel from './components/AnalysisPanel';
import { AppState, IntentMode } from './types';
import { analyzePdf, translateAnalysisResult } from './services/geminiService';
import { AlertTriangle, ShieldAlert, FileText, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    file: null,
    fileUrl: null,
    isProcessing: false,
    analysis: null,
    translatedAnalysis: null, // Cache for Chinese
    language: 'en',
    mode: IntentMode.SKIM,
    error: null,
    rejectionReason: null,
  });

  const [activeCitationText, setActiveCitationText] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    if (file.type !== 'application/pdf') {
      setState(prev => ({ ...prev, error: "Only PDF files are supported." }));
      return;
    }

    const url = URL.createObjectURL(file);

    setState(prev => ({ 
      ...prev, 
      file, 
      fileUrl: url, 
      isProcessing: true, 
      error: null,
      rejectionReason: null, // Reset rejection
      analysis: null,
      translatedAnalysis: null,
      language: 'en'
    }));

    try {
      const result = await analyzePdf(file);
      
      // GATEKEEPER CHECK
      if (!result.isValidResearchContent) {
        setState(prev => ({
          ...prev,
          isProcessing: false,
          rejectionReason: result.rejectionReason || "This document does not appear to be an academic paper or research report."
        }));
        return;
      }

      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        analysis: result 
      }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        error: "Failed to analyze PDF. Please check your API Key or try a text-based PDF." 
      }));
    }
  };

  const handleCitationClick = (id: number) => {
    // We always use the 'analysis' (English base) for citation lookup if possible, 
    // but the ID logic is the same across both languages.
    const currentData = state.language === 'en' ? state.analysis : (state.translatedAnalysis || state.analysis);
    
    if (currentData) {
      const citation = currentData.citations.find(c => c.id === id);
      if (citation) {
        setActiveCitationText(citation.snippet);
      }
    }
  };

  const handleLanguageToggle = async () => {
    if (!state.analysis) return;

    if (state.language === 'en') {
      // Switching to Chinese
      if (state.translatedAnalysis) {
        // Use cached
        setState(prev => ({ ...prev, language: 'zh' }));
      } else {
        // Need to translate
        setState(prev => ({ ...prev, isProcessing: true }));
        try {
           const translated = await translateAnalysisResult(state.analysis);
           setState(prev => ({ 
             ...prev, 
             language: 'zh', 
             translatedAnalysis: translated,
             isProcessing: false 
           }));
        } catch (err) {
           console.error("Translation failed", err);
           setState(prev => ({ ...prev, isProcessing: false, error: "Translation failed. Please try again." }));
        }
      }
    } else {
      // Switching back to English (Instant)
      setState(prev => ({ ...prev, language: 'en' }));
    }
  };

  const resetApp = () => {
    setState({
      file: null,
      fileUrl: null,
      isProcessing: false,
      analysis: null,
      translatedAnalysis: null,
      language: 'en',
      mode: IntentMode.SKIM,
      error: null,
      rejectionReason: null,
    });
  };

  // Select data based on current language
  const currentData = state.language === 'zh' ? (state.translatedAnalysis || state.analysis) : state.analysis;

  // Landing State
  if (!state.file) {
    return <Landing onFileSelect={handleFileSelect} error={state.error} />;
  }

  // Workspace Layout
  return (
    <div className="h-screen flex flex-col lg:flex-row overflow-hidden bg-gray-100">
      
      {/* Left Panel: PDF Viewer */}
      <div className="w-full lg:w-1/2 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-gray-300 relative shadow-2xl z-10 bg-gray-200">
        <PdfViewer 
          fileUrl={state.fileUrl} 
          activeCitation={activeCitationText} 
        />
        {state.analysis && (
          <div className="absolute top-0 left-0 w-full bg-yellow-500/90 text-white text-[10px] py-1 text-center font-bold uppercase tracking-wider backdrop-blur-md">
             Analysis limited to first 10 pages
          </div>
        )}
      </div>

      {/* Right Panel: AI Copilot */}
      <div className="w-full lg:w-1/2 h-1/2 lg:h-full bg-white relative z-20">
        {state.rejectionReason ? (
          // REJECTION CARD (Gatekeeper Triggered)
          <div className="h-full flex flex-col items-center justify-center p-12 bg-gray-50/50">
             <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <ShieldAlert size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-serif font-bold text-slate-900 mb-2">Content Rejected</h3>
                <p className="text-slate-600 mb-6 leading-relaxed text-sm">
                  {state.rejectionReason}
                </p>
                
                <div className="bg-blue-50/50 rounded-lg p-4 text-xs text-left text-slate-600 mb-6 border border-blue-50">
                   <p className="font-bold text-academic-600 mb-2 flex items-center gap-1">
                     <FileText size={12} /> Accepted Formats:
                   </p>
                   <ul className="list-disc pl-4 space-y-1">
                     <li>Academic Research Papers</li>
                     <li>Scientific Journal Articles</li>
                     <li>Professional Research Reports</li>
                   </ul>
                </div>

                <button 
                  onClick={resetApp}
                  className="w-full py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw size={16} />
                  Upload Another File
                </button>
             </div>
          </div>
        ) : state.error ? (
           // ERROR STATE
           <div className="h-full flex flex-col items-center justify-center text-center p-10">
              <AlertTriangle size={40} className="text-red-500 mb-4" />
              <h3 className="text-lg font-bold text-slate-800">Processing Error</h3>
              <p className="text-gray-500 mt-2">{state.error}</p>
              <button 
                onClick={resetApp}
                className="mt-6 px-6 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                Try Another File
              </button>
           </div>
        ) : (
          // SUCCESS STATE
          <AnalysisPanel 
            mode={state.mode} 
            setMode={(mode) => setState(prev => ({ ...prev, mode }))}
            data={currentData} 
            loading={state.isProcessing}
            onCitationClick={handleCitationClick}
            language={state.language}
            onLanguageToggle={handleLanguageToggle}
          />
        )}
      </div>
    </div>
  );
};

export default App;