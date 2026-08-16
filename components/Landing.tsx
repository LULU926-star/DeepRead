import React from 'react';
import { UploadCloud, FileText, AlertCircle } from 'lucide-react';

interface LandingProps {
  onFileSelect: (file: File) => void;
  error?: string | null;
}

const Landing: React.FC<LandingProps> = ({ onFileSelect, error }) => {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  return (
    <div className="h-screen w-full bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-6">
      <div className="max-w-xl w-full text-center">
        
        {/* Logo/Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-serif font-bold text-slate-900 mb-2">DeepRead</h1>
          <p className="text-lg text-slate-600">The "task-based" intelligent reading weapon for researchers.</p>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-2xl shadow-xl p-10 border border-gray-100 transition-transform hover:scale-[1.01] duration-300">
            <div className="border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50 p-12 flex flex-col items-center justify-center relative group hover:border-academic-600 hover:bg-blue-50/30 transition-all cursor-pointer">
              <input 
                type="file" 
                accept="application/pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={handleFileChange}
              />
              <div className="bg-white p-4 rounded-full shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                <UploadCloud size={32} className="text-academic-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Drop your PDF here</h3>
              <p className="text-sm text-gray-500 mb-6">or click to browse local files</p>
              
              <div className="flex gap-4 text-xs text-gray-400 font-medium bg-white px-4 py-2 rounded-full border border-gray-100">
                 <span className="flex items-center gap-1"><FileText size={12}/> Max 10 Pages</span>
                 <span className="w-px h-3 bg-gray-200"></span>
                 <span>Text-based PDF only</span>
              </div>
            </div>

            {error && (
              <div className="mt-6 flex items-center justify-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg text-sm animate-shake">
                <AlertCircle size={16} />
                {error}
              </div>
            )}
        </div>

        <p className="mt-8 text-xs text-gray-400">
           Protected by Gatekeeper™ • Powered by Gemini Flash
        </p>
      </div>
    </div>
  );
};

export default Landing;