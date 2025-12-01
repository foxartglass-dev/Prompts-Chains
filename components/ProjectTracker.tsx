import React from 'react';
import Icon from './Icon.tsx';

interface ProjectTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

const ProjectTracker: React.FC<ProjectTrackerProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-800 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-cyan-500/30">
        <header className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-cyan-400 flex items-center gap-3">
            <Icon type="document" className="h-6 w-6" />
            Project Tracker & Changelog
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </header>

        <main className="p-6 overflow-y-auto space-y-6">
          <section>
            <h3 className="text-xl font-semibold text-white mb-3 border-b border-gray-600 pb-2">To-Do List</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-green-400 mb-2">Easy</h4>
                <ul className="list-none space-y-2 text-gray-300 pl-4 border-l-2 border-green-400/30">
                   <li className="flex items-start gap-3"><span className="text-xl mt-px">⚫</span><div><strong className="text-white">Auto-Save Drafts:</strong> Implement auto-save to local storage for the current project to prevent data loss.</div></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-yellow-400 mb-2">Medium</h4>
                <ul className="list-none space-y-2 text-gray-300 pl-4 border-l-2 border-yellow-400/30">
                  <li className="flex items-start gap-3"><span className="text-xl mt-px">⚫</span><div><strong className="text-white">Undo/Redo Functionality:</strong> Implement a simple undo/redo stack for minor edits within a project session.</div></li>
                  <li className="flex items-start gap-3"><span className="text-xl mt-px">⚫</span><div><strong className="text-white">Create Settings Page:</strong> Relocate API Keys and other global settings to a dedicated settings page to declutter the main UI.</div></li>
                  <li className="flex items-start gap-3"><span className="text-xl mt-px">⚫</span><div><strong className="text-white">Sub-projects:</strong> Allow nesting projects within other projects (e.g., Client > Website 1, Website 2).</div></li>
                   <li className="flex items-start gap-3"><span className="text-xl mt-px">⚫</span><div><strong className="text-white">SaaS UI (Payments):</strong> Build the frontend components for Square integration (API key input, subscription status).</div></li>
                </ul>
              </div>
              <div>
                <h4 className="font-bold text-red-400 mb-2">Hard</h4>
                <ul className="list-none space-y-2 text-gray-300 pl-4 border-l-2 border-red-400/30">
                  <li className="flex items-start gap-3"><span className="text-xl mt-px">⚫</span><div><strong className="text-white">Advanced Workflow Modules:</strong> Add support for non-prompt "Action Steps" (e.g., calling ZeroGPT mid-workflow) and conditional logic (if/then branching).</div></li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-xl font-semibold text-white mb-3 border-b border-gray-600 pb-2">Completed Tasks</h3>
            <ul className="list-none space-y-2 text-gray-300">
               <li className="flex items-start gap-3 text-gray-400"><span className="text-green-400 text-xl mt-px">✔</span><div><strong className="text-gray-200">Project Management System:</strong> Replaced versioning with a robust system to create, save, and load multiple, independent projects.</div></li>
              <li className="flex items-start gap-3 text-gray-400"><span className="text-green-400 text-xl mt-px">✔</span><div><strong className="text-gray-200">Project Tracker UI:</strong> Added this panel to keep a persistent log of our to-do list and changelog.</div></li>
              <li className="flex items-start gap-3 text-gray-400"><span className="text-green-400 text-xl mt-px">✔</span><div><strong className="text-gray-200">UI/UX Fixes:</strong> Fixed the disappearing menu on tagged placeholders, added a "Duplicate" button to prompts, and added an "Add Prompt Step" button to the bottom of the workflow.</div></li>
            </ul>
          </section>
        </main>
      </div>
    </div>
  );
};

export default ProjectTracker;