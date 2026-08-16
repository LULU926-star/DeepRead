import React from 'react';
import { IntentMode } from '../types';
import { Zap, Brain, Microscope } from 'lucide-react';

interface IntentBarProps {
  currentMode: IntentMode;
  onModeChange: (mode: IntentMode) => void;
}

const IntentBar: React.FC<IntentBarProps> = ({ currentMode, onModeChange }) => {
  return (
    <div className="w-full bg-gray-100 p-1 rounded-lg flex items-center justify-between shadow-inner relative">
      {/* Skim Mode */}
      <button
        onClick={() => onModeChange(IntentMode.SKIM)}
        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
          currentMode === IntentMode.SKIM
            ? 'bg-white text-academic-600 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Zap size={16} className={currentMode === IntentMode.SKIM ? "fill-current" : ""} />
        Skim
      </button>

      {/* Learn Mode */}
      <button
        onClick={() => onModeChange(IntentMode.LEARN)}
        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
          currentMode === IntentMode.LEARN
            ? 'bg-white text-academic-600 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Brain size={16} />
        Learn
      </button>

      {/* Deep Dive Mode (Unlocked) */}
      <button
        onClick={() => onModeChange(IntentMode.DEEP_DIVE)}
        className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-sm font-medium transition-all duration-200 ${
          currentMode === IntentMode.DEEP_DIVE
            ? 'bg-white text-academic-600 shadow-sm'
            : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        <Microscope size={16} />
        Deep Dive
      </button>
    </div>
  );
};

export default IntentBar;