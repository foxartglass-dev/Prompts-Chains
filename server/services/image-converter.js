/**
 * Image Converter Service
 * Handles HEIC/HEIF → JPEG conversion and thumbnail generation using sharp.
 * All images pass through here on upload so the rest of the system only deals with JPEG/PNG.
 */

import sharp from 'sharp';

// File extensions that need conversion
const HEIC_EXTENSIONS = ['.heic', '.heif'];

// MIME types that need conversion
const HEIC_MIME_TYPES = ['image/heic', 'image/heif', 'image/heic-sequence', 'image/heif-sequence'];

/**
 * Check if a file needs HEIC→JPEG conversion based on extension or MIME type
 */
export function needsConversion(filename, mimetype) {
  if (!filename && !mimetype) return false;

  if (filename) {
    const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
    if (HEIC_EXTENSIONS.includes(ext)) return true;
  }

  if (mimetype) {
    if (HEIC_MIME_TYPES.includes(mimetype.toLowerCase())) return true;
    // Some systems report HEIC as application/octet-stream
    if (mimetype === 'application/octet-stream' && filename) {
      const ext = filename.toLowerCase().slice(filename.lastIndexOf('.'));
      if (HEIC_EXTENSIONS.includes(ext)) return true;
    }
  }

  return false;
}

/**
 * Convert an image buffer to JPEG using sharp.
 * - Automatically rotates based on EXIF orientation
 * - Strips metadata (privacy)
 * - Converts to sRGB color space
 * - Resizes to maxWidth if larger
 *
 * @param {Buffer} inputBuffer - Raw image file buffer
 * @param {Object} options
 * @param {number} options.maxWidth - Max width in pixels (default 2048)
 * @param {number} options.quality - JPEG quality 1-100 (default 90)
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
export async function convertToJpeg(inputBuffer, options = {}) {
  const { maxWidth = 2048, quality = 90 } = options;

  let pipeline = sharp(inputBuffer)
    .rotate() // Auto-rotate based on EXIF orientation
    .toColorspace('srgb'); // Consistent color space

  // Get metadata to check dimensions
  const metadata = await sharp(inputBuffer).metadata();

  // Resize if wider than maxWidth
  if (metadata.width && metadata.width > maxWidth) {
    pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
  }

  const result = await pipeline
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    size: result.info.size
  };
}

/**
 * Generate a thumbnail from an image buffer
 *
 * @param {Buffer} inputBuffer - Raw image file buffer (any format sharp supports)
 * @param {number} size - Thumbnail max dimension (default 512)
 * @param {number} quality - JPEG quality (default 80)
 * @returns {Promise<{ buffer: Buffer, width: number, height: number }>}
 */
export async function generateThumbnail(inputBuffer, size = 512, quality = 80) {
  const result = await sharp(inputBuffer)
    .rotate()
    .toColorspace('srgb')
    .resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    size: result.info.size
  };
}

/**
 * Convert a buffer to a base64 data URL
 * @param {Buffer} buffer - JPEG buffer
 * @returns {string} data:image/jpeg;base64,... string
 */
export function bufferToDataUrl(buffer) {
  return `data:image/jpeg;base64,${buffer.toString('base64')}`;
}

/**
 * Process an uploaded file: convert if HEIC, generate display + thumbnail versions
 * Returns base64 data URLs ready for storage/display.
 *
 * @param {Buffer} fileBuffer - Raw uploaded file buffer
 * @param {string} filename - Original filename
 * @param {string} mimetype - Original MIME type
 * @returns {Promise<{ display: string, thumb: string, width: number, height: number, converted: boolean, newFilename: string }>}
 */
export async function processUploadedImage(fileBuffer, filename, mimetype) {
  const isHeic = needsConversion(filename, mimetype);

  // Convert or just process the image
  const display = await convertToJpeg(fileBuffer, { maxWidth: 2048, quality: 90 });
  const thumb = await generateThumbnail(fileBuffer, 512, 80);

  // Generate new filename with .jpg extension if converted from HEIC
  let newFilename = filename;
  if (isHeic) {
    newFilename = filename.replace(/\.(heic|heif)$/i, '.jpg');
  }

  return {
    display: bufferToDataUrl(display.buffer),
    thumb: bufferToDataUrl(thumb.buffer),
    width: display.width,
    height: display.height,
    converted: isHeic,
    newFilename
  };
}
