import React from 'react';
import { motion } from 'motion/react';

interface BuyScoreGaugeProps {
  score: number;
}

export const BuyScoreGauge: React.FC<BuyScoreGaugeProps> = ({ score }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 75) return '#10b981'; // emerald-500
    if (s >= 50) return '#f59e0b'; // amber-500
    if (s >= 25) return '#f97316'; // orange-500
    return '#ef4444'; // rose-500
  };

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
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
        <span className="text-2xl font-bold">{score}</span>
        <span className="text-[8px] uppercase tracking-widest font-bold text-white/40">Buy Score</span>
      </div>
    </div>
  );
};
