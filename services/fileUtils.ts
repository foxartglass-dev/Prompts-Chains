import { Service } from '../types.ts';

export function parseCsv(csvText: string): Service[] {
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
  const serviceNameIndex = headers.findIndex(h => h.toLowerCase() === 'service_name');

  // 3. Improved error message if column is still not found
  if (serviceNameIndex === -1) {
    throw new Error(`CSV must contain a "service_name" column. Detected headers: [${headers.join(', ')}]`);
  }

  return lines.slice(1).map((line, index) => {
    // Note: This simple split doesn't handle commas within quoted fields.
    // It is assumed service names do not contain commas.
    const values = line.split(',');
    const serviceName = values[serviceNameIndex]?.trim() || '';
    
    // Extract tag from service_name, e.g., "Standard Cleaning(H)" -> "H"
    const tagMatch = serviceName.match(/\((H|J|C)\)/);
    const tag = tagMatch ? tagMatch[1] as 'H' | 'J' | 'C' : null;

    let category: string | null = null;
    if (tag === 'H') {
      category = 'House Cleaning Service';
    } else if (tag === 'J') {
      category = 'Janitorial Service';
    } else if (tag === 'C') {
      category = 'Construction Site Cleaning';
    }

    return {
      id: index,
      service_name: serviceName,
      tag,
      category,
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