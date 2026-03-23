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
        <circle cx="50" cy="50" r="48" stroke="currentColor" strokeWidth="1" />
        <circle cx="50" cy="50" r="44" stroke="currentColor" strokeWidth="1" />
        <path d="M30 80 L50 20 L70 80 M38 55 L62 55" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M25 80 L35 80" stroke="currentColor" strokeWidth="4" />
        <path d="M65 80 L75 80" stroke="currentColor" strokeWidth="4" />
        <path d="M47 20 L53 20" stroke="currentColor" strokeWidth="4" />
      </svg>
      
      {/* Wordmark */}
      {variant === 'full' && (
        <span className="serif text-2xl font-medium tracking-wide text-ink uppercase">Antique Hunter</span>
      )}
    </div>
  );
};

export default Logo;
