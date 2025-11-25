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
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60"
      onClick={handleBackdropClick}
    >
      <div className="bg-gray-900 border border-gray-700 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <Icon type="info" className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-cyan-400">
              Project Tracker &amp; Changelog
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close project tracker"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-6 text-sm text-gray-200">
          <section>
            <h3 className="text-base font-semibold text-gray-300 mb-2">To-Do List</h3>

            <h4 className="text-sm font-semibold text-gray-400">Easy</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>
                Auto-Save Drafts: Implement auto-save to local storage for the current
                project to prevent data loss.
              </li>
            </ul>

            <h4 className="text-sm font-semibold text-gray-400">Medium</h4>
            <ul className="list-disc list-inside space-y-1 mb-3">
              <li>
                Undo/Redo Functionality: Implement a simple undo/redo stack for minor
                edits within a project session.
              </li>
              <li>
                Create Settings Page: Relocate API keys and other global settings to a
                dedicated settings page to declutter the main UI.
              </li>
              <li>
                Sub-projects: Allow nesting projects within other projects (e.g., Client
                &gt; Website 1, Website 2).
              </li>
              <li>
                SaaS UI (Payments): Build the frontend components for Square integration
                (API key input, subscription status).
              </li>
            </ul>

            <h4 className="text-sm font-semibold text-gray-400">Hard</h4>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Advanced Workflow Modules: Add support for non-prompt “Action Steps”
                (e.g., calling ZeroGPT mid-workflow) and conditional logic (if/then
                branching).
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-base font-semibold text-gray-300 mb-2">
              Completed Tasks
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Project Management System: Replaced versioning with a robust system to
                create, save, and load multiple independent projects.
              </li>
              <li>
                Project Tracker UI: Added this panel to keep a persistent log of our
                to-do list and changelog.
              </li>
              <li>
                UI/UX Fixes: Fixed the disappearing menu on tagged placeholders, added a
                “Duplicate” button to prompts, and added an “Add Prompt Step” button to
                the bottom of the workflow.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProjectTracker;