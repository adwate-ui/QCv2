import { QCAnalysisResult, BoundingBox, Discrepancy } from '../types';

/**
 * Performs smart QC analysis on a product image
 * @param qcImage - URL of the image to analyze
 * @param productName - Name of the product being analyzed
 * @returns Promise resolving to QCAnalysisResult
 */
export const performSmartQC = async (
  qcImage: string,
  productName: string
): Promise<QCAnalysisResult> => {
  // Simulate API call with a delay
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Mock analysis result with sample discrepancies
  const mockDiscrepancies: Discrepancy[] = [
    {
      description: 'Logo alignment issue',
      boundingBox: {
        ymin: 100,
        xmin: 150,
        ymax: 250,
        xmax: 350
      }
    },
    {
      description: 'Stitching defect detected',
      boundingBox: {
        ymin: 400,
        xmin: 500,
        ymax: 500,
        xmax: 650
      }
    },
    {
      description: 'Color inconsistency',
      boundingBox: {
        ymin: 600,
        xmin: 200,
        ymax: 750,
        xmax: 400
      }
    }
  ];

  const mockResult: QCAnalysisResult = {
    discrepancies: mockDiscrepancies,
    summary: `Quality control analysis completed for ${productName}. ${mockDiscrepancies.length} discrepancies detected. The product shows signs of minor manufacturing defects that may affect overall quality.`,
    qualityScore: 72
  };

  return mockResult;
};
