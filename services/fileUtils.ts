import { WorkflowItem } from '../types.ts';

export function parseCsv(csvText: string): WorkflowItem[] {
  // 1. Handle BOM and normalize line endings
  let text = csvText.trim();
  if (text.startsWith('\uFEFF')) {
    text = text.substring(1);
  }
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');

  if (lines.length < 2) {
    throw new Error('CSV file must have a header row and at least one data row.');
  }

  // 2. Process headers robustly (trim whitespace, remove quotes)
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const nameIndex = headers.findIndex(h => h.toLowerCase() === 'name' || h.toLowerCase() === 'item_name');


  // 3. Improved error message if column is still not found
  if (nameIndex === -1) {
    throw new Error(`CSV must contain a "name" or "item_name" column. Detected headers: [${headers.join(', ')}]`);
  }

  return lines.slice(1).map((line, index) => {
    // Note: This simple split doesn't handle commas within quoted fields.
    const values = line.split(',');
    const itemName = values[nameIndex]?.trim() || '';
    
    // Extract tag from item_name, e.g., "Topic A(H)" -> "H"
    const tagMatch = itemName.match(/\(([^)]+)\)/);
    const tag = tagMatch ? tagMatch[1] : null;

    return {
      id: index,
      name: itemName,
      tag,
    };
  });
}

export function downloadFile(content: string, filename: string, mimeType: string) {
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