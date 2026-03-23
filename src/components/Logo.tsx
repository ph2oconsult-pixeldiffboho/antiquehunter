import React from 'react';

interface LogoProps {
  className?: string;
  variant?: 'centered' | 'left';
}

const Logo: React.FC<LogoProps> = ({ className = "", variant = 'left' }) => {
  return (
    <div className={`flex ${variant === 'centered' ? 'justify-center' : 'justify-start'} ${className}`}>
      <span className="serif font-light tracking-[0.2em] text-ink uppercase">
        Antique <span className="text-gold">Hunter</span>
      </span>
    </div>
  );
};

export default Logo;
