import React, { useState, useEffect } from 'react';
import { performSmartQC } from '../services/smartQCService';
import { QCAnalysisResult } from '../types';
import { Loader2 } from 'lucide-react';

interface QCInspectionProps {
  qcImage: string;
  productName: string;
}

export const QCInspection: React.FC<QCInspectionProps> = ({ qcImage, productName }) => {
  const [analysisResult, setAnalysisResult] = useState<QCAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);

  useEffect(() => {
    const analyzeImage = async () => {
      setIsAnalyzing(true);
      try {
        const result = await performSmartQC(qcImage, productName);
        setAnalysisResult(result);
      } catch (error) {
        console.error('Error analyzing image:', error);
      } finally {
        setIsAnalyzing(false);
      }
    };

    analyzeImage();
  }, [qcImage, productName]);

  const convertBoundingBoxToCSS = (boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number }) => {
    // Convert from 0-1000 scale to percentage
    const top = (boundingBox.ymin / 1000) * 100;
    const left = (boundingBox.xmin / 1000) * 100;
    const bottom = (boundingBox.ymax / 1000) * 100;
    const right = (boundingBox.xmax / 1000) * 100;
    const width = right - left;
    const height = bottom - top;

    return {
      top: `${top}%`,
      left: `${left}%`,
      width: `${width}%`,
      height: `${height}%`
    };
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return 'PASS';
    if (score >= 60) return 'CAUTION';
    return 'FAIL';
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">{productName} - Quality Inspection</h2>
      
      {isAnalyzing ? (
        <div className="flex flex-col items-center justify-center p-12 bg-gray-50 rounded-lg">
          <Loader2 className="animate-spin h-12 w-12 text-blue-500 mb-4" />
          <p className="text-gray-600 text-lg">Analyzing...</p>
        </div>
      ) : (
        <>
          {/* Image with Overlays */}
          <div className="relative inline-block w-full mb-6">
            <img 
              src={qcImage} 
              alt={productName}
              className="w-full h-auto rounded-lg shadow-lg"
            />
            
            {/* Discrepancy Overlays */}
            {analysisResult?.discrepancies.map((discrepancy, index) => {
              const cssProps = convertBoundingBoxToCSS(discrepancy.boundingBox);
              return (
                <div
                  key={index}
                  className="absolute border-2 border-red-500 rounded-lg pointer-events-none"
                  style={{
                    top: cssProps.top,
                    left: cssProps.left,
                    width: cssProps.width,
                    height: cssProps.height
                  }}
                >
                  {/* Floating Label */}
                  <div className="absolute -top-8 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap pointer-events-auto">
                    {discrepancy.description}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Analysis Summary */}
          {analysisResult && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="mb-4">
                <h3 className="text-xl font-semibold mb-2">Quality Score</h3>
                <div className="flex items-center gap-4">
                  <div className={`text-4xl font-bold ${getScoreColor(analysisResult.qualityScore)}`}>
                    {analysisResult.qualityScore}/100
                  </div>
                  <span className={`text-xl font-semibold px-4 py-2 rounded ${
                    analysisResult.qualityScore >= 80 
                      ? 'bg-green-100 text-green-700' 
                      : analysisResult.qualityScore >= 60 
                        ? 'bg-yellow-100 text-yellow-700' 
                        : 'bg-red-100 text-red-700'
                  }`}>
                    {getScoreLabel(analysisResult.qualityScore)}
                  </span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-xl font-semibold mb-2">Analysis Summary</h3>
                <p className="text-gray-700">{analysisResult.summary}</p>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-xl font-semibold mb-2">
                  Discrepancies Found: {analysisResult.discrepancies.length}
                </h3>
                <ul className="list-disc list-inside space-y-2">
                  {analysisResult.discrepancies.map((discrepancy, index) => (
                    <li key={index} className="text-gray-700">
                      {discrepancy.description}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
