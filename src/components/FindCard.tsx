import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Calendar, ArrowRight, Trash2 } from 'lucide-react';

interface FindCardProps {
  find: {
    id: string;
    title: string;
    image?: string;
    images?: string[];
    analysis: {
      buyScore: number;
      buyLabel: string;
      period: string;
    };
    status: string;
    location?: string;
    createdAt: any;
  };
  onClick: () => void;
  onDelete: (e: React.MouseEvent) => void;
}

export const FindCard: React.FC<FindCardProps> = ({ find, onClick, onDelete }) => {
  const date = find.createdAt?.toDate ? find.createdAt.toDate().toLocaleDateString() : new Date(find.createdAt).toLocaleDateString();
  const displayImage = find.images?.[0] || find.image;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className="group bg-white rounded-[32px] overflow-hidden border border-zinc-100 shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer relative"
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {displayImage ? (
          <img src={displayImage} alt={find.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
            <span className="text-zinc-300 font-serif text-4xl">?</span>
          </div>
        )}
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
          {find.status}
        </div>
        <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm text-white ${
          find.analysis.buyScore >= 75 ? 'bg-emerald-500' : 
          find.analysis.buyScore >= 50 ? 'bg-amber-500' : 'bg-rose-500'
        }`}>
          Score: {find.analysis.buyScore}
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="serif text-xl font-light tracking-tight group-hover:text-zinc-600 transition-colors line-clamp-1">{find.title}</h3>
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">{find.analysis.buyLabel}</p>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-zinc-50">
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-bold">{date}</span>
            </div>
            {find.location && (
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span className="text-[10px] font-bold line-clamp-1">{find.location}</span>
              </div>
            )}
          </div>
          <button
            onClick={onDelete}
            className="p-2 text-zinc-300 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
