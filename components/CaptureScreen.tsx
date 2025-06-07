'use client';

import { useState } from 'react';
import MicIcon from './MicIcon';
import ImageIcon from './ImageIcon';

export default function CaptureScreen() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    
    setLoading(true);
    // TODO: replace with real API call
    await new Promise(r => setTimeout(r, 1200));
    setResult([
      'Problem: Users forget trip essentials',
      'Target: Digital nomads and frequent travelers',
      'Feature: Destination-based smart checklist generator'
    ]);
    setLoading(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background-alt to-background flex flex-col items-center p-4">
      {/* Header */}
      <div className="text-center mt-12 mb-8">
        <h1 className="text-4xl font-bold text-text mb-2 tracking-tight">
          Skrible
        </h1>
        <p className="text-text-muted text-lg">
          Transform your ideas into structured insights
        </p>
      </div>

      {/* Main capture interface */}
      <div className="w-full max-w-2xl bg-white rounded-3xl p-8 transition-all duration-300">
        <div className="relative">
          <textarea
            className="
              w-full h-40 p-6 rounded-2xl
              focus:ring-4 focus:ring-primary/10
              transition-all duration-200 ease-in-out resize-none
              text-text placeholder-text-muted text-lg leading-relaxed
              outline-none bg-gray-50/50
            "
            placeholder="Type your idea, speak your thoughts, or sketch your vision... 
Press ⌘+Enter to Skrible!"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
          />

          {/* Voice & Image icons */}
          <div className="absolute bottom-4 left-4 flex space-x-2">
            <button className="icon-button p-3 rounded-full hover:bg-secondary-light transition-all duration-200">
              <MicIcon className="w-6 h-6 text-secondary" />
            </button>
            <button className="icon-button p-3 rounded-full hover:bg-secondary-light transition-all duration-200">
              <ImageIcon className="w-6 h-6 text-secondary" />
            </button>
          </div>

          {/* Character count */}
          <div className="absolute bottom-4 right-4 text-sm text-text-muted">
            {input.length} characters
          </div>
        </div>

        <button
          onClick={handleSubmit}
          disabled={loading || !input.trim()}
          className={`
            capture-button mt-8 w-full py-4 font-semibold text-white rounded-2xl
            transition-all duration-300 ease-in-out text-lg
            ${loading || !input.trim()
              ? 'opacity-50 cursor-not-allowed transform-none'
              : 'hover:scale-[1.02] active:scale-[0.98]'
            }
          `}
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Skribling your idea...</span>
            </div>
          ) : (
            'Skrible It! 🚀'
          )}
        </button>

        {/* Result panel */}
        {result && (
          <div className="mt-8 bg-gradient-to-r from-secondary-light to-purple-50 rounded-2xl p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-text mb-4 flex items-center">
              <span className="w-2 h-2 rounded-full bg-primary mr-3"></span>
              Your Skribbled Insights
            </h3>
            <div className="space-y-3">
              {result.map((line, i) => (
                <div key={i} className="flex items-start space-x-3 group">
                  <span 
                    className={`
                      inline-block w-3 h-3 rounded-full mt-1 transition-all duration-200
                      ${i === 0 ? 'bg-orange-500' : i === 1 ? 'bg-blue-500' : 'bg-green-500'}
                      group-hover:scale-110
                    `}
                  />
                  <span className="text-text leading-relaxed flex-1 group-hover:text-text-dark transition-colors">
                    {line}
                  </span>
                </div>
              ))}
            </div>
            
            {/* Action buttons */}
            <div className="flex space-x-3 mt-6 pt-4">
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium">
                Refine
              </button>
              <button className="px-4 py-2 bg-gray-100 text-text rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                Export
              </button>
              <button className="px-4 py-2 bg-gray-100 text-text rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium">
                Share
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-12 text-center text-text-muted text-sm">
        <p>Powered by AI • Made for creators, thinkers, and dreamers</p>
      </div>
    </div>
  );
}