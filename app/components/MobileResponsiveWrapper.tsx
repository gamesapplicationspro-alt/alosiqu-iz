import React from 'react';

interface MobileResponsiveWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export default function MobileResponsiveWrapper({ 
  children, 
  className = '' 
}: MobileResponsiveWrapperProps) {
  return (
    <div className={`w-full max-w-7xl mx-auto px-2 sm:px-4 lg:px-8 ${className}`}>
      {children}
    </div>
  );
}
