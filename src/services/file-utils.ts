// File Utilities

import { WorkflowItem } from '../engine/types';

/**
 * Parse CSV content into workflow items
 * Expected format: name,tag or just name (tag extracted from parentheses)
 */
export function parseCsv(csvText: string): WorkflowItem[] {
  const lines = csvText.trim().split(/\r?\n/);
  const items: WorkflowItem[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    // Try to extract tag from parentheses at end: "Topic Name(B)"
    const tagMatch = trimmed.match(/\(([^)]+)\)$/);
    const tag = tagMatch ? tagMatch[1] : null;
    const name = tagMatch ? trimmed.replace(/\([^)]+\)$/, '').trim() : trimmed;

    items.push({
      id: index,
      name: trimmed, // Keep original format for display
      tag,
    });
  });

  return items;
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download a project config as JSON
 */
export function downloadProjectConfig(config: object, filename: string): void {
  const content = JSON.stringify(config, null, 2);
  downloadFile(content, filename, 'application/json');
}

/**
 * Load a project config from a JSON file
 * Returns a Promise that resolves with the parsed config
 */
export function loadProjectConfigFromFile(file: File): Promise<object> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const config = JSON.parse(content);
        resolve(config);
      } catch (error) {
        reject(new Error('Invalid JSON file'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
