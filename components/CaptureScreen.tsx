'use client';

import MicIcon from './MicIcon';
import ImageIcon from './ImageIcon';
import { useEffect, useState } from 'react';


export default function CaptureScreen() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

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

  
  useEffect(() => {
    fetchIdeas();
  }, []);

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
            // onKeyDown={handleKeyPress}
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
      
      {/* Only show saved ideas section if we have ideas or API is configured */}
      {(savedIdeas.length > 0 || API_URL) && (
        <div className="mt-6 w-full max-w-2xl">
          <h2 className="text-xl font-semibold mb-2 text-text">Saved Ideas</h2>
          {activeTag && (
            <button
              onClick={() => setActiveTag(null)}
              className="text-sm text-blue-600 underline mb-2"
            >
              Clear tag filter
            </button>
          )}
          {savedIdeas.length === 0 && API_URL && (
            <p className="text-text-muted text-sm">No saved ideas yet. Start by submitting your first idea!</p>
          )}
          <ul className="space-y-2">
            {filteredIdeas.map((idea, index) => (
              <li key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                <p className="text-sm text-gray-700 mb-2"><strong>Input:</strong> {idea.input_text}</p>
                <p className="text-sm text-gray-600 mb-2"><strong>Output:</strong></p>
                <ul className="list-disc pl-5 text-sm text-gray-800 mb-3">
                  {idea.output.map((line: string, i: number) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
                {idea.tags && idea.tags.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm text-gray-600 mb-2"><strong>Tags:</strong></p>
                    <div className="flex flex-wrap gap-2">
                      {idea.tags?.map((tag, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveTag(tag)}
                          className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full hover:bg-primary/20 transition"
                        >
                          #{tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer */}
      <div className="mt-12 text-center text-text-muted text-sm">
        <p>Powered by AI • Made for creators, thinkers, and dreamers</p>
      </div>
    </div>
  );
}