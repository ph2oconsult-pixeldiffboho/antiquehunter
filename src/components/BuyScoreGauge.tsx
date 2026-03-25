import React from 'react';
import { motion } from 'motion/react';

interface BuyScoreGaugeProps {
  score: number;
  confidence?: string;
}

const BuyScoreGauge: React.FC<BuyScoreGaugeProps> = ({ score, confidence }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 65) return 'var(--color-decision-green)';
    if (s >= 45) return 'var(--color-decision-gold)';
    return 'var(--color-decision-red)';
  };

  return (
    <div className="relative w-24 h-24 flex items-center justify-center border border-white/10 rounded-full">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          className="text-white/10"
        />
        <motion.circle
          cx="48"
          cy="48"
          r={radius}
          stroke={getColor(score)}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold tracking-tighter">{score}</span>
        <div className="flex flex-col items-center -mt-1">
          <span className="text-[7px] uppercase tracking-widest font-bold text-white/60">Investment Rating</span>
          {confidence && (
            <span className="text-[6px] uppercase tracking-widest font-bold text-white/30">{confidence.replace('_', ' ')}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BuyScoreGauge;
