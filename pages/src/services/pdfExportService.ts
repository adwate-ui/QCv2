import { jsPDF } from 'jspdf';
import { QCReport, Product } from '../types';
import { db } from './db';

// PDF Layout Constants
const PDF_MARGIN = 20;
const PDF_COMPARISON_IMAGE_HEIGHT = 80;

/**
 * Export a QC report as a PDF document
 * @param report - QC report to export
 * @param product - Product associated with the report
 * @param userId - User ID for accessing images
 */
export const exportQCReportToPDF = async (
  report: QCReport,
  product: Product,
  userId: string
): Promise<void> => {
  const doc = new jsPDF();
  let yPos = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PDF_MARGIN;
  const contentWidth = pageWidth - 2 * margin;
  
  // Helper to load and add images to PDF
  const addImageToPDF = async (imageData: string, x: number, y: number, width: number, height: number) => {
    try {
      // Ensure we have a data URL
      const dataUrl = imageData.startsWith('data:') ? imageData : `data:image/jpeg;base64,${imageData}`;
      doc.addImage(dataUrl, 'JPEG', x, y, width, height);
    } catch (error) {
      console.error('Error adding image to PDF:', error);
      // Draw a placeholder rectangle if image fails to load
      doc.setFillColor(240, 240, 240);
      doc.rect(x, y, width, height, 'F');
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text('Image not available', x + width / 2, y + height / 2, { align: 'center' });
    }
  };

  // Helper to check if we need a new page
  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
      return true;
    }
    return false;
  };

  // Helper to add wrapped text
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    if (isBold) {
      doc.setFont('helvetica', 'bold');
    } else {
      doc.setFont('helvetica', 'normal');
    }
    
    const lines = doc.splitTextToSize(text, contentWidth);
    const lineHeight = fontSize * 0.4;
    const totalHeight = lines.length * lineHeight;
    
    checkPageBreak(totalHeight + 5);
    
    lines.forEach((line: string) => {
      doc.text(line, margin, yPos);
      yPos += lineHeight;
    });
    
    yPos += 3;
  };

  // Header
  doc.setFillColor(34, 197, 94); // Green
  doc.rect(0, 0, pageWidth, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('AuthentiqC - QC Inspection Report', margin, 18);
  doc.setTextColor(0, 0, 0);
  yPos = 40;

  // Product Information
  addText(`Product: ${product.profile.name}`, 16, true);
  addText(`Brand: ${product.profile.brand}`, 12);
  addText(`Category: ${product.profile.category}`, 12);
  yPos += 5;

  // Report metadata
  addText(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 10);
  addText(`Model: ${report.modelTier} | Mode: ${report.expertMode}`, 10);
  yPos += 5;

  // Overall Score Section
  checkPageBreak(40);
  doc.setFillColor(241, 245, 249); // slate-100
  doc.rect(margin, yPos, contentWidth, 30, 'F');
  
  yPos += 10;
  addText(`Overall Score: ${report.overallScore}/100`, 14, true);
  
  // Grade with color
  const gradeColor: [number, number, number] = report.overallGrade === 'PASS' ? [34, 197, 94] : 
                     report.overallGrade === 'CAUTION' ? [251, 191, 36] : [239, 68, 68];
  doc.setTextColor(...gradeColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(`Grade: ${report.overallGrade}`, margin, yPos);
  doc.setTextColor(0, 0, 0);
  yPos += 15;

  // Summary
  checkPageBreak(30);
  addText('Summary:', 12, true);
  addText(report.summary, 10);
  yPos += 5;

  // Sections
  addText('Detailed Analysis:', 14, true);
  yPos += 3;

  for (const section of report.sections) {
    checkPageBreak(60);
    
    // Section header with colored bar
    const sectionColor: [number, number, number] = section.grade === 'PASS' ? [34, 197, 94] : 
                         section.grade === 'CAUTION' ? [251, 191, 36] : [239, 68, 68];
    
    doc.setFillColor(...sectionColor);
    doc.rect(margin, yPos, 5, 8, 'F');
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(section.sectionName, margin + 8, yPos + 6);
    
    doc.setFontSize(10);
    doc.setTextColor(...sectionColor);
    doc.text(`${section.score}/100 - ${section.grade}`, pageWidth - margin - 50, yPos + 6);
    doc.setTextColor(0, 0, 0);
    
    yPos += 12;

    // Add side-by-side comparison image if available
    if (report.sectionComparisons && report.sectionComparisons[section.sectionName]) {
      const comparison = report.sectionComparisons[section.sectionName];
      
      // Check if we need space for the comparison image
      const imageHeight = PDF_COMPARISON_IMAGE_HEIGHT;
      checkPageBreak(imageHeight + 10);
      
      try {
        // Load the comparison image (which contains both reference and QC images side-by-side)
        if (comparison.diffImageId) {
          const comparisonImageData = await db.getImage(comparison.diffImageId);
          if (comparisonImageData) {
            // Add label
            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(100, 100, 100);
            doc.text('Comparison:', margin + 5, yPos);
            yPos += 5;
            
            // Add the comparison image (full width)
            const imageWidth = contentWidth;
            await addImageToPDF(comparisonImageData, margin, yPos, imageWidth, imageHeight);
            yPos += imageHeight + 5;
          }
        }
      } catch (error) {
        console.error(`Error adding comparison image for ${section.sectionName}:`, error instanceof Error ? error.message : String(error));
        // Continue without the image - the text observations will still be included
      }
    }

    // Observations
    if (section.observations && section.observations.length > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      
      section.observations.forEach((obs, idx) => {
        checkPageBreak(10);
        const bullet = `• ${obs}`;
        const lines = doc.splitTextToSize(bullet, contentWidth - 5);
        lines.forEach((line: string) => {
          doc.text(line, margin + 5, yPos);
          yPos += 4;
        });
      });
    }
    
    yPos += 5;
  }

  // Additional Information
  if (report.requestForMoreInfo && report.requestForMoreInfo.length > 0) {
    checkPageBreak(40);
    addText('Additional Questions:', 12, true);
    report.requestForMoreInfo.forEach((info) => {
      addText(`• ${info}`, 10);
    });
    yPos += 5;
  }

  if (report.userComments) {
    checkPageBreak(30);
    addText('User Comments:', 12, true);
    addText(report.userComments, 10);
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages} | AuthentiqC QC Report | ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Generate filename
  const filename = `QC-${product.profile.brand}-${product.profile.name}-${new Date(report.generatedAt).toISOString().split('T')[0]}.pdf`;
  
  // Save the PDF
  doc.save(filename);
};
