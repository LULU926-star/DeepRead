import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface PdfViewerProps {
  fileUrl: string | null;
  activeCitation: string | null;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ fileUrl, activeCitation }) => {
  const [highlighting, setHighlighting] = useState(false);

  useEffect(() => {
    if (activeCitation) {
      setHighlighting(true);
      // Simulate the "Find" and "Scroll" delay
      const timer = setTimeout(() => {
        setHighlighting(false);
      }, 1500); // Flash duration
      return () => clearTimeout(timer);
    }
  }, [activeCitation]);

  if (!fileUrl) {
    return (
      <div className="h-full w-full bg-gray-100 flex items-center justify-center text-gray-400">
        <p>No document loaded</p>
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-gray-200 flex flex-col relative">
      {/* Floating Toolbar (Visual only for MVP) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white px-4 py-2 rounded-full shadow-lg z-10 flex gap-4 text-sm backdrop-blur-sm opacity-0 hover:opacity-100 transition-opacity duration-300">
        <button className="hover:text-blue-300">Prev</button>
        <span>Page 1 / 10</span>
        <button className="hover:text-blue-300">Next</button>
        <span className="border-l border-gray-600 mx-2"></span>
        <button className="hover:text-blue-300">Fit</button>
      </div>

      {/* Grounding/Search Overlay Effect */}
      {highlighting && activeCitation && (
        <div className="absolute top-10 right-10 bg-yellow-100 border border-yellow-400 text-yellow-800 px-4 py-2 rounded shadow-xl z-50 animate-bounce flex items-center gap-2">
            <Search size={16} />
            <span className="text-xs font-bold">Locating:</span>
            <span className="text-xs truncate max-w-[200px] italic">"{activeCitation.substring(0, 30)}..."</span>
        </div>
      )}

      {/* 
        Using an iframe for PDF rendering. 
        Note: Programmatic text highlighting inside a cross-origin iframe (even local blob) is restricted by browser security.
        For a production app, we would use 'react-pdf' to render Canvas/Text layers. 
        For this MVP, we simulate the 'reaction' to the click via the overlay above.
      */}
      <iframe 
        src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=0`} 
        className="w-full h-full border-none bg-white" 
        title="PDF Viewer"
      />
      
      {/* Overlay to simulate fuzzy matching feedback if iframe blocks interaction */}
      {highlighting && (
         <div className="absolute inset-0 bg-yellow-500/10 pointer-events-none animate-pulse z-0 mix-blend-multiply" />
      )}
    </div>
  );
};

export default PdfViewer;