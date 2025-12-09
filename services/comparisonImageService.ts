/**
 * Service for generating side-by-side comparison images with highlighted differences
 */

import { BoundingBox } from '../types';

/**
 * Converts a data URL or blob URL to an Image element
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
};

/**
 * Draws a bounding box with a red circle/rectangle on the canvas
 */
const drawHighlight = (
  ctx: CanvasRenderingContext2D,
  boundingBox: BoundingBox,
  imageWidth: number,
  imageHeight: number,
  offsetX: number = 0
) => {
  // Convert from 0-1000 scale to actual pixels
  const x = (boundingBox.xmin / 1000) * imageWidth + offsetX;
  const y = (boundingBox.ymin / 1000) * imageHeight;
  const width = ((boundingBox.xmax - boundingBox.xmin) / 1000) * imageWidth;
  const height = ((boundingBox.ymax - boundingBox.ymin) / 1000) * imageHeight;

  // Draw red rectangle
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  // Draw arrow pointing to the issue (with bounds checking)
  const arrowSize = 20;
  const arrowOffsetX = Math.max(arrowSize, x);
  const arrowOffsetY = Math.max(arrowSize, y);
  
  ctx.fillStyle = '#EF4444';
  ctx.beginPath();
  const arrowX = arrowOffsetX - arrowSize;
  const arrowY = arrowOffsetY - arrowSize;
  ctx.moveTo(arrowX, arrowY);
  ctx.lineTo(arrowX + 10, arrowY - 10);
  ctx.lineTo(arrowX + 5, arrowY - 10);
  ctx.lineTo(arrowX + 5, arrowY - 20);
  ctx.lineTo(arrowX - 5, arrowY - 20);
  ctx.lineTo(arrowX - 5, arrowY - 10);
  ctx.lineTo(arrowX - 10, arrowY - 10);
  ctx.closePath();
  ctx.fill();
};

/**
 * Generates a side-by-side comparison image
 * @param referenceImageSrc - URL or data URL of the reference (authentic) image
 * @param qcImageSrc - URL or data URL of the QC image
 * @param discrepancies - Optional array of bounding boxes to highlight on the QC image
 * @returns Promise resolving to a data URL of the comparison image
 */
export const generateComparisonImage = async (
  referenceImageSrc: string,
  qcImageSrc: string,
  discrepancies?: BoundingBox[]
): Promise<string> => {
  try {
    // Load both images
    const [refImg, qcImg] = await Promise.all([
      loadImage(referenceImageSrc),
      loadImage(qcImageSrc)
    ]);

    // Determine dimensions - use the larger height and scale proportionally
    const maxHeight = 800; // Max height for each image
    const refAspect = refImg.width / refImg.height;
    const qcAspect = qcImg.width / qcImg.height;

    const refScaledHeight = Math.min(refImg.height, maxHeight);
    const refScaledWidth = refScaledHeight * refAspect;
    
    const qcScaledHeight = Math.min(qcImg.height, maxHeight);
    const qcScaledWidth = qcScaledHeight * qcAspect;

    // Make both images the same height for better comparison
    const finalHeight = Math.max(refScaledHeight, qcScaledHeight);
    const finalRefWidth = finalHeight * refAspect;
    const finalQcWidth = finalHeight * qcAspect;

    // Create canvas with padding between images
    const padding = 40;
    const canvas = document.createElement('canvas');
    canvas.width = finalRefWidth + finalQcWidth + padding * 3;
    canvas.height = finalHeight + padding * 2;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Fill background
    ctx.fillStyle = '#F3F4F6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw labels
    ctx.fillStyle = '#1F2937';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Reference (Authentic)', padding + finalRefWidth / 2, 25);
    ctx.fillText('QC Image', padding * 2 + finalRefWidth + finalQcWidth / 2, 25);

    // Draw reference image
    ctx.drawImage(refImg, padding, padding, finalRefWidth, finalHeight);

    // Draw QC image
    const qcOffsetX = padding * 2 + finalRefWidth;
    ctx.drawImage(qcImg, qcOffsetX, padding, finalQcWidth, finalHeight);

    // Draw highlights on QC image if discrepancies are provided
    if (discrepancies && discrepancies.length > 0) {
      discrepancies.forEach(bbox => {
        drawHighlight(ctx, bbox, finalQcWidth, finalHeight, qcOffsetX);
      });
    }

    // Convert to data URL
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error('Error generating comparison image:', error);
    throw error;
  }
};

/**
 * Generates a diff highlight image (just the QC image with highlights)
 * @param qcImageSrc - URL or data URL of the QC image
 * @param discrepancies - Array of bounding boxes to highlight
 * @returns Promise resolving to a data URL of the highlighted image
 */
export const generateHighlightImage = async (
  qcImageSrc: string,
  discrepancies: BoundingBox[]
): Promise<string> => {
  try {
    const qcImg = await loadImage(qcImageSrc);

    // Create canvas matching image size
    const canvas = document.createElement('canvas');
    canvas.width = qcImg.width;
    canvas.height = qcImg.height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    // Draw original image
    ctx.drawImage(qcImg, 0, 0);

    // Draw highlights
    discrepancies.forEach(bbox => {
      drawHighlight(ctx, bbox, canvas.width, canvas.height);
    });

    // Convert to data URL
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch (error) {
    console.error('Error generating highlight image:', error);
    throw error;
  }
};
