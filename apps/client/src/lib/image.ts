/**
 * Ephemeral Image Optimization Engine
 * Sanitizes, resizes, strips EXIF metadata, and converts images into compressed Data URLs.
 */

const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const MAX_FILE_SIZE_BYTES = 500 * 1024; // 500KB cap
const MAX_DIMENSION_PX = 1280; // Longest edge max dimension

export interface ProcessedImageResult {
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
}

/**
 * Validates and processes a File into a safe, downscaled WebP/JPEG data URL <= 500KB
 */
export async function processDropImage(file: File): Promise<ProcessedImageResult> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported file type: ${file.type || 'unknown'}. Only PNG, JPEG, and WebP images are allowed.`
    );
  }

  // Load image onto an Image element
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Failed to decode image file'));
      image.src = objectUrl;
    });

    // Calculate downscaled dimensions preserving aspect ratio
    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth <= 0 || targetHeight <= 0) {
      throw new Error('Invalid image dimensions');
    }

    if (targetWidth > MAX_DIMENSION_PX || targetHeight > MAX_DIMENSION_PX) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight * MAX_DIMENSION_PX) / targetWidth);
        targetWidth = MAX_DIMENSION_PX;
      } else {
        targetWidth = Math.round((targetWidth * MAX_DIMENSION_PX) / targetHeight);
        targetHeight = MAX_DIMENSION_PX;
      }
    }

    // Render onto in-memory Canvas (naturally strips EXIF and camera metadata)
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable');
    }

    // High quality smoothing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    // Iteratively compress with quality ramp-down until <= 500KB
    let quality = 0.86;
    let mimeType = 'image/webp';
    let dataUrl = canvas.toDataURL(mimeType, quality);

    // Check if browser actually supports WebP export (fallback to JPEG if necessary)
    if (!dataUrl.startsWith('data:image/webp')) {
      mimeType = 'image/jpeg';
      dataUrl = canvas.toDataURL(mimeType, quality);
    }

    // Approximate size from base64 string length
    let approximateBytes = Math.round((dataUrl.length * 3) / 4);

    while (approximateBytes > MAX_FILE_SIZE_BYTES && quality > 0.3) {
      quality -= 0.15;
      dataUrl = canvas.toDataURL(mimeType, quality);
      approximateBytes = Math.round((dataUrl.length * 3) / 4);
    }

    if (approximateBytes > MAX_FILE_SIZE_BYTES) {
      throw new Error('Image too large even after compression. Please choose a smaller image.');
    }

    return {
      dataUrl,
      width: targetWidth,
      height: targetHeight,
      sizeBytes: approximateBytes,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
