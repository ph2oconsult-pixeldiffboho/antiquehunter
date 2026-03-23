import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'full' | 'icon';
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10", variant = 'full' }) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Monogram */}
      <svg viewBox="0 0 100 100" className="w-10 h-10 text-gold" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M50 10 L20 90 M50 10 L80 90 M35 50 L65 50" stroke="currentColor" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 10 L20 90 M80 10 L80 90" stroke="currentColor" strokeWidth="8" strokeLinecap="round" />
      </svg>
      
      {/* Wordmark */}
      {variant === 'full' && (
        <span className="serif text-xl font-medium tracking-tight text-ink">Antique Hunter</span>
      )}
    </div>
  );
};

export default Logo;
