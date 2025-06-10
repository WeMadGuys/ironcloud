'use client';

import MicIcon from './MicIcon';
import ImageIcon from './ImageIcon';
import PaperclipIcon from './PaperclipIcon';
import PenToolIcon from './PenToolIcon';
import LeftNavigation from './LeftNavigation';
import RightPanel from './RightPanel';
import { useEffect, useState } from 'react';

export default function CaptureScreen() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);
  const [activeMode, setActiveMode] = useState<'text' | 'voice' | 'attachment' | 'canvas'>('text');
  const [activeSection, setActiveSection] = useState('capture');

  type Idea = {
    input_text: string;
    output: string[];
    tags: string[];
  };
  const [savedIdeas, setSavedIdeas] = useState<Idea[]>([]);
  const [tags, setTags] = useState("");
  const filteredIdeas = activeTag
  ? savedIdeas.filter(idea => idea.tags?.includes(activeTag))
  : savedIdeas;

  const API_URL = process.env.NEXT_PUBLIC_API_BASE_URL;

const handleSubmit = async () => {
  if (!API_URL) {
    setApiError('API URL not configured. Please set NEXT_PUBLIC_API_BASE_URL in your environment variables.');
    return;
  }

  setLoading(true);
  setApiError(null);
  
  try {
    const res = await fetch(
      `${API_URL}/api/process-idea`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: input, tags }),
      }
    );

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    setResult(data.output);
    await fetchIdeas();
    
    // Clear the text boxes after successful submission
    setInput('');
    setTags('');
  } catch (err) {
    console.error("Error talking to backend:", err);
    setApiError('Failed to process idea. Please check if the API server is running.');
  } finally {
    setLoading(false);
  }
};

const fetchIdeas = async () => {
  if (!API_URL) {
    // Silently fail if API URL is not configured
    return;
  }

  try {
    const res = await fetch(`${API_URL}/api/ideas`);
    
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    
    const data = await res.json();
    setSavedIdeas(data);
    setApiError(null);
  } catch (err) {
    // Only log the error, don't show it to user for initial fetch
    console.warn("Backend API not available - this is expected if the API server isn't running");
    // Don't show error for initial fetch failure - just keep empty state
  }
};

  const handleModeChange = (mode: 'text' | 'voice' | 'attachment' | 'canvas') => {
    setActiveMode(mode);
    // Add mode-specific logic here
    switch (mode) {
      case 'voice':
        // TODO: Implement voice recording
        console.log('Voice mode activated');
        break;
      case 'attachment':
        // TODO: Implement file attachment
        console.log('Attachment mode activated');
        break;
      case 'canvas':
        // TODO: Implement drawing canvas
        console.log('Canvas mode activated');
        break;
      default:
        console.log('Text mode activated');
    }
  };
  
  useEffect(() => {
    fetchIdeas();
  }, []);

  const renderMainContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Skrible</h1>
              <p className="text-xl text-gray-600 mb-8">Get started by Script a task and Chat can do the rest. Not sure where to start?</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                <div className="bg-orange-100 p-6 rounded-2xl hover:bg-orange-200 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-white text-xl">✏️</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Write copy</h3>
                  <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <span className="text-gray-600">+</span>
                  </button>
                </div>
                
                <div className="bg-blue-100 p-6 rounded-2xl hover:bg-blue-200 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-white text-xl">🖼️</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Image generation</h3>
                  <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <span className="text-gray-600">+</span>
                  </button>
                </div>
                
                <div className="bg-green-100 p-6 rounded-2xl hover:bg-green-200 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-white text-xl">👤</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Create avatar</h3>
                  <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <span className="text-gray-600">+</span>
                  </button>
                </div>
                
                <div className="bg-pink-100 p-6 rounded-2xl hover:bg-pink-200 transition-colors cursor-pointer">
                  <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center mb-4 mx-auto">
                    <span className="text-white text-xl">💻</span>
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">Write code</h3>
                  <button className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
                    <span className="text-gray-600">+</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      
      case 'capture':
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-8">
            {/* API Error Alert */}
            {apiError && (
              <div className="w-full max-w-2xl mb-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-red-500 mr-3"></div>
                  <p className="text-red-700 text-sm">{apiError}</p>
                </div>
              </div>
            )}

            {/* Main capture interface */}
            <div className="w-full max-w-2xl bg-white rounded-3xl border border-gray-200 p-8 transition-all duration-300">
              <div className="relative">
                <textarea
                  className="
                    w-full h-40 p-6 rounded-2xl
                    focus:ring-4 focus:ring-primary/10
                    transition-all duration-200 ease-in-out resize-none
                    text-text placeholder-text-muted text-lg leading-relaxed
                    outline-none bg-gray-50/50 border border-gray-200
                  "
                  placeholder="Type your idea, speak your thoughts, or sketch your vision... 
Press ⌘+Enter to Skrible!"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                />

                {/* Character count */}
                <div className="absolute bottom-4 right-4 text-sm text-text-muted">
                  {input.length} characters
                </div>
              </div>

              {/* Four Skrible Input Options */}
              <div className="flex items-center justify-between mt-4 p-4 bg-gray-50/50 rounded-2xl border border-gray-200">
                <div className="flex space-x-3">
                  {/* Text Mode */}
                  <button 
                    onClick={() => handleModeChange('text')}
                    className={`icon-button p-3 rounded-full transition-all duration-200 ${
                      activeMode === 'text' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'hover:bg-secondary-light'
                    }`}
                    title="Text Mode"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                    </svg>
                  </button>

                  {/* Voice Mode */}
                  <button 
                    onClick={() => handleModeChange('voice')}
                    className={`icon-button p-3 rounded-full transition-all duration-200 ${
                      activeMode === 'voice' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'hover:bg-secondary-light'
                    }`}
                    title="Voice Mode"
                  >
                    <MicIcon className="w-6 h-6" />
                  </button>

                  {/* Attachment Mode */}
                  <button 
                    onClick={() => handleModeChange('attachment')}
                    className={`icon-button p-3 rounded-full transition-all duration-200 ${
                      activeMode === 'attachment' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'hover:bg-secondary-light'
                    }`}
                    title="Attachment Mode"
                  >
                    <PaperclipIcon className="w-6 h-6" />
                  </button>

                  {/* Canvas Mode */}
                  <button 
                    onClick={() => handleModeChange('canvas')}
                    className={`icon-button p-3 rounded-full transition-all duration-200 ${
                      activeMode === 'canvas' 
                        ? 'bg-primary text-white shadow-lg' 
                        : 'hover:bg-secondary-light'
                    }`}
                    title="Canvas Mode"
                  >
                    <PenToolIcon className="w-6 h-6" />
                  </button>
                </div>

                {/* Mode indicator */}
                <div className="text-sm text-text-muted capitalize">
                  {activeMode} mode
                </div>
              </div>

              <input
                type="text"
                className="w-full mt-4 p-3 rounded-xl border border-gray-300 text-sm"
                placeholder="Add tags (comma separated)..."
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />

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
                <div className="mt-8 bg-gradient-to-r from-secondary-light to-purple-50 rounded-2xl p-6 animate-fade-in border border-gray-200">
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
          </div>
        );
      
      default:
        return (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 capitalize">{activeSection}</h2>
              <p className="text-gray-600">This section is coming soon!</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Left Navigation */}
      <LeftNavigation 
        activeSection={activeSection} 
        onSectionChange={setActiveSection} 
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="bg-white border-b border-gray-200 px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900 capitalize">{activeSection}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors text-sm font-medium">
                ⚡ Upgrade
              </button>
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        {renderMainContent()}
      </div>

      {/* Right Panel */}
      <RightPanel 
        savedIdeas={savedIdeas}
        activeTag={activeTag}
        onTagClick={setActiveTag}
        onClearTagFilter={() => setActiveTag(null)}
      />
    </div>
  );
}