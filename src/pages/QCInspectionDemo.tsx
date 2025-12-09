import React from 'react';
import { QCInspection } from './QCInspection';

/**
 * Demo page to showcase the QCInspection component
 * This can be accessed by adding a route in App.tsx
 */
export const QCInspectionDemo: React.FC = () => {
  // Sample product image - using a placeholder
  const sampleImage = 'https://via.placeholder.com/800x600/cccccc/666666?text=Product+Image';
  const productName = 'Luxury Handbag';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">QC Inspection Demo</h1>
          <p className="text-gray-600">
            This page demonstrates the QCInspection component with a sample product analysis.
          </p>
        </div>
        
        <QCInspection 
          qcImage={sampleImage}
          productName={productName}
        />
      </div>
    </div>
  );
};
