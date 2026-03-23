import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'centered' | 'left';
}

const Logo: React.FC<LogoProps> = ({ className = "", variant = 'left' }) => {
  return (
    <div className={`flex ${variant === 'centered' ? 'justify-center' : 'justify-start'} ${className}`}>
      <span className="font-serif font-semibold tracking-tight text-ink uppercase">
        <span className="relative before:absolute before:-top-1 before:-right-0.5 before:w-0.5 before:h-3 before:bg-paper before:rotate-[20deg]">A</span>ntique <span className="text-gold">Hunter</span>
      </span>
    </div>
  );
};

export default Logo;
