/**
 * Image optimization utilities for better performance
 * Handles compression, resizing, and format conversion
 */

import { IMAGE } from './constants';
import { log } from './logger';

/**
 * Compress an image to reduce file size
 * @param dataUrl - Base64 data URL of the image
 * @param quality - Quality level (0-1), default 0.85
 * @returns Promise resolving to compressed image data URL
 */
export async function compressImage(
  dataUrl: string,
  quality: number = IMAGE.QUALITY
): Promise<string> {
  const startTime = performance.now();

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        // Calculate dimensions while maintaining aspect ratio
        let { width, height } = img;
        const maxDimension = IMAGE.MAX_DIMENSIONS;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = (height / width) * maxDimension;
            width = maxDimension;
          } else {
            width = (width / height) * maxDimension;
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', quality);

        const duration = performance.now() - startTime;
        const originalSize = dataUrl.length;
        const compressedSize = compressed.length;
        const reduction = ((1 - compressedSize / originalSize) * 100).toFixed(1);

        log.performance('Image compression', duration, {
          originalSize: `${Math.round(originalSize / 1024)}KB`,
          compressedSize: `${Math.round(compressedSize / 1024)}KB`,
          reduction: `${reduction}%`,
        });

        resolve(compressed);
      } catch (error) {
        log.error('Image compression failed', error);
        reject(error);
      }
    };

    img.onerror = () => {
      const error = new Error('Failed to load image for compression');
      log.error('Image load failed', error);
      reject(error);
    };

    img.src = dataUrl;
  });
}

/**
 * Resize an image to specific dimensions
 * @param dataUrl - Base64 data URL of the image
 * @param maxWidth - Maximum width in pixels
 * @param maxHeight - Maximum height in pixels
 * @returns Promise resolving to resized image data URL
 */
export async function resizeImage(
  dataUrl: string,
  maxWidth: number,
  maxHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        let { width, height } = img;

        // Calculate new dimensions while maintaining aspect ratio
        if (width > maxWidth || height > maxHeight) {
          const widthRatio = maxWidth / width;
          const heightRatio = maxHeight / height;
          const ratio = Math.min(widthRatio, heightRatio);

          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        resolve(canvas.toDataURL('image/jpeg', IMAGE.QUALITY));
      } catch (error) {
        log.error('Image resize failed', error);
        reject(error);
      }
    };

    img.onerror = () => {
      const error = new Error('Failed to load image for resizing');
      log.error('Image load failed', error);
      reject(error);
    };

    img.src = dataUrl;
  });
}

/**
 * Get image dimensions without loading the full image
 * @param dataUrl - Base64 data URL of the image
 * @returns Promise resolving to {width, height}
 */
export async function getImageDimensions(
  dataUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/**
 * Convert image to specific format
 * @param dataUrl - Base64 data URL of the image
 * @param format - Target format ('jpeg', 'png', 'webp')
 * @param quality - Quality for lossy formats (0-1)
 * @returns Promise resolving to converted image data URL
 */
export async function convertImageFormat(
  dataUrl: string,
  format: 'jpeg' | 'png' | 'webp',
  quality: number = IMAGE.QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          throw new Error('Failed to get canvas context');
        }

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const mimeType = `image/${format}`;
        resolve(canvas.toDataURL(mimeType, quality));
      } catch (error) {
        log.error('Image format conversion failed', error);
        reject(error);
      }
    };

    img.onerror = () => {
      const error = new Error('Failed to load image for format conversion');
      log.error('Image load failed', error);
      reject(error);
    };

    img.src = dataUrl;
  });
}

/**
 * Validate image data URL
 * @param dataUrl - Base64 data URL to validate
 * @returns true if valid, false otherwise
 */
export function isValidImageDataUrl(dataUrl: string): boolean {
  if (!dataUrl || typeof dataUrl !== 'string') {
    return false;
  }

  // Check if it starts with data:image/
  if (!dataUrl.startsWith('data:image/')) {
    return false;
  }

  // Check if it contains base64 data
  if (!dataUrl.includes('base64,')) {
    return false;
  }

  return true;
}

/**
 * Get file size from data URL in bytes
 * @param dataUrl - Base64 data URL
 * @returns Size in bytes
 */
export function getDataUrlSize(dataUrl: string): number {
  // Remove data URL prefix to get base64 string
  const base64 = dataUrl.split(',')[1];
  if (!base64) return 0;

  // Calculate size: base64 is ~33% larger than binary
  // Each base64 character is 6 bits
  const padding = (base64.match(/=/g) || []).length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

/**
 * Format bytes to human-readable string
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
