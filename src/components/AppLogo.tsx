import React from 'react';

const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Magnifying Glass */}
      <circle cx="45" cy="45" r="30" stroke="currentColor" strokeWidth="8" />
      <line x1="65" y1="65" x2="90" y2="90" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      
      {/* Serif A inside */}
      <path d="M45 25 L30 65 M45 25 L60 65 M35 50 L55 50" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default Logo;
