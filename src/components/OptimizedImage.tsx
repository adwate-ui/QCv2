import React, { useState } from 'react';

interface OptimizedImageProps {
  src: string;
  alt: string;
  className?: string;
  aspectRatio?: string;
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  className = '',
  aspectRatio = 'auto',
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio }}
    >
      {/* Skeleton loader with pulse animation */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-300 animate-pulse" />
      )}

      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        className={`w-full h-full object-cover transition-opacity duration-500 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
    </div>
  );
};
