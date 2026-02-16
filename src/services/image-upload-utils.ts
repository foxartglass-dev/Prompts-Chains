/**
 * Image Upload Utilities
 * Client-side helpers for image upload with automatic HEIC→JPEG conversion.
 * HEIC files are sent to the server for conversion; all other formats
 * are processed locally with FileReader.
 */

const HEIC_EXTENSIONS = ['.heic', '.heif'];
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

/**
 * Check if a File object is a HEIC/HEIF image that needs server-side conversion
 */
export function isHeicFile(file: File): boolean {
  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
  if (HEIC_EXTENSIONS.includes(ext)) return true;
  if (HEIC_MIME_TYPES.includes(file.type.toLowerCase())) return true;
  // Some systems report HEIC as empty type or octet-stream
  if ((file.type === '' || file.type === 'application/octet-stream') && HEIC_EXTENSIONS.includes(ext)) return true;
  return false;
}

/**
 * Read a non-HEIC file as a data URL using FileReader
 */
function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface ProcessedImage {
  dataUrl: string;
  thumb?: string;
  filename: string;
  width?: number;
  height?: number;
  converted: boolean;
}

/**
 * Process a single image file. If HEIC, converts via server. Otherwise reads locally.
 * Returns a JPEG/PNG data URL that any browser can display.
 */
export async function processImageFile(file: File): Promise<ProcessedImage> {
  if (!isHeicFile(file)) {
    // Standard image - read directly
    const dataUrl = await readAsDataUrl(file);
    return {
      dataUrl,
      filename: file.name,
      converted: false
    };
  }

  // HEIC file - send to server for conversion
  const formData = new FormData();
  formData.append('images', file);

  const res = await fetch('/api/images/convert', {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: 'Conversion failed' }));
    throw new Error(errData.error || `Server returned ${res.status}`);
  }

  const data = await res.json();
  if (!data.success || !data.images || data.images.length === 0) {
    throw new Error('No converted image returned');
  }

  const img = data.images[0];
  return {
    dataUrl: img.dataUrl,
    thumb: img.thumb,
    filename: img.filename,
    width: img.width,
    height: img.height,
    converted: true
  };
}

/**
 * Process multiple image files in parallel, converting HEIC files via server.
 * Non-HEIC files are read locally. HEIC files are batched into a single server request.
 *
 * @param files - FileList or File array
 * @param onProgress - Optional callback for progress updates (processed, total)
 * @returns Array of processed images (JPEG/PNG data URLs)
 */
export async function processImageFiles(
  files: FileList | File[],
  onProgress?: (processed: number, total: number) => void
): Promise<ProcessedImage[]> {
  const fileArray = Array.from(files);
  const total = fileArray.length;

  // Separate HEIC and non-HEIC files
  const heicFiles: File[] = [];
  const normalFiles: File[] = [];

  for (const file of fileArray) {
    if (isHeicFile(file)) {
      heicFiles.push(file);
    } else {
      normalFiles.push(file);
    }
  }

  const results: ProcessedImage[] = [];
  let processed = 0;

  // Process normal files locally (fast, parallel)
  const normalPromises = normalFiles.map(async (file) => {
    const dataUrl = await readAsDataUrl(file);
    processed++;
    onProgress?.(processed, total);
    return {
      dataUrl,
      filename: file.name,
      converted: false
    } as ProcessedImage;
  });

  const normalResults = await Promise.all(normalPromises);
  results.push(...normalResults);

  // Batch convert HEIC files via server
  if (heicFiles.length > 0) {
    const formData = new FormData();
    for (const file of heicFiles) {
      formData.append('images', file);
    }

    try {
      const res = await fetch('/api/images/convert', {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.images) {
          for (const img of data.images) {
            processed++;
            onProgress?.(processed, total);
            results.push({
              dataUrl: img.dataUrl,
              thumb: img.thumb,
              filename: img.filename,
              width: img.width,
              height: img.height,
              converted: true
            });
          }
        }
      } else {
        // Fall back to individual conversion on batch failure
        for (const file of heicFiles) {
          try {
            const result = await processImageFile(file);
            processed++;
            onProgress?.(processed, total);
            results.push(result);
          } catch (err) {
            console.error(`Failed to convert ${file.name}:`, err);
            processed++;
            onProgress?.(processed, total);
          }
        }
      }
    } catch (err) {
      console.error('[HEIC Batch Convert] Network error:', err);
      // If server is unreachable, skip HEIC files with error
      for (const file of heicFiles) {
        processed++;
        onProgress?.(processed, total);
        console.error(`Skipped ${file.name}: server conversion unavailable`);
      }
    }
  }

  return results;
}

/**
 * Accept string for file inputs that includes HEIC/HEIF
 * Use this for all image upload <input> elements
 */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png,.gif,.webp';
