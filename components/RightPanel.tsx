'use client';

import { useState } from 'react';
import { MoreHorizontal, Plus } from 'lucide-react';

interface Idea {
  input_text: string;
  output: string[];
  tags: string[];
}

interface RightPanelProps {
  savedIdeas: Idea[];
  activeTag: string | null;
  onTagClick: (tag: string) => void;
  onClearTagFilter: () => void;
}

export default function RightPanel({ savedIdeas, activeTag, onTagClick, onClearTagFilter }: RightPanelProps) {
  const [showAllProjects, setShowAllProjects] = useState(false);
  
  const filteredIdeas = activeTag
    ? savedIdeas.filter(idea => idea.tags?.includes(activeTag))
    : savedIdeas;

  // Mock projects data for demonstration
  const projects = [
    { id: 1, title: 'New Project', description: '' },
    { id: 2, title: 'Learning From 100 Years o...', description: 'For athletes, high altitude prod...' },
    { id: 3, title: 'Research officiants', description: "Maxwell's equations—the four..." },
    { id: 4, title: 'What does a senior lead de...', description: 'Physiological respiration involv...' },
    { id: 5, title: 'Write a sweet note to your...', description: 'In the eighteenth century the G...' },
    { id: 6, title: 'Meet with cake bakers', description: 'Physical space is often conceiv...' },
  ];

  const displayedProjects = showAllProjects ? projects : projects.slice(0, 6);

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Projects (7)</h2>
          <button className="p-1 hover:bg-gray-100 rounded">
            <MoreHorizontal className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 space-y-3">
          {displayedProjects.map((project) => (
            <div
              key={project.id}
              className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 text-sm mb-1 truncate group-hover:text-primary transition-colors">
                    {project.title}
                  </h3>
                  {project.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {project.description}
                    </p>
                  )}
                </div>
                {project.id === 1 && (
                  <Plus className="w-4 h-4 text-gray-400 ml-2 flex-shrink-0" />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved Ideas Section */}
      {savedIdeas.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Saved Ideas</h3>
            {activeTag && (
              <button
                onClick={onClearTagFilter}
                className="text-xs text-primary hover:text-primary-dark"
              >
                Clear filter
              </button>
            )}
          </div>
          
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {filteredIdeas.slice(0, 3).map((idea, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                  <strong>Input:</strong> {idea.input_text}
                </p>
                <div className="text-xs text-gray-500 mb-2">
                  <strong>Output:</strong>
                  <ul className="list-disc pl-4 mt-1">
                    {idea.output.slice(0, 2).map((line: string, i: number) => (
                      <li key={i} className="line-clamp-1">{line}</li>
                    ))}
                  </ul>
                </div>
                {idea.tags && idea.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {idea.tags.slice(0, 3).map((tag, i) => (
                      <button
                        key={i}
                        onClick={() => onTagClick(tag)}
                        className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full hover:bg-primary/20 transition"
                      >
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            
            {filteredIdeas.length > 3 && (
              <button className="w-full text-xs text-primary hover:text-primary-dark py-2">
                View all {filteredIdeas.length} ideas
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}