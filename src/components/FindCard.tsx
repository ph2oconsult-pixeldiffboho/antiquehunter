import React from 'react';
import { motion } from 'motion/react';
import { MapPin, Calendar, ArrowRight, Trash2 } from 'lucide-react';

interface FindCardProps {
  find: {
    id: string;
    title: string;
    category?: string;
    image?: string;
    images?: string[];
    analysis: any; // The full analysis object or array
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
  
  const items = Array.isArray(find.analysis) ? find.analysis : [find.analysis];
  const mainItem = items[0];
  const score = mainItem.buy_decision.score;
  const label = mainItem.buy_decision.label;

  const getScoreColor = (s: number) => {
    if (s >= 65) return 'bg-decision-green';
    if (s >= 45) return 'bg-decision-gold';
    return 'bg-decision-red';
  };

  const getScoreTextColor = (s: number) => {
    if (s >= 65) return 'text-decision-green';
    if (s >= 45) return 'text-decision-gold';
    return 'text-decision-red';
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className="group bg-white rounded-[32px] overflow-hidden border border-border-custom shadow-sm hover:shadow-xl transition-all duration-500 cursor-pointer relative"
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        {displayImage ? (
          <img src={displayImage} alt={find.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
        ) : (
          <div className="w-full h-full bg-paper flex items-center justify-center">
            <span className="text-muted/20 font-serif text-4xl">?</span>
          </div>
        )}
        <div className="absolute top-4 right-4 px-3 py-1 bg-white/90 backdrop-blur-md rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm">
          {find.status}
        </div>
        <div className={`absolute bottom-4 left-4 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm text-white ${getScoreColor(score)}`}>
          Score: {score}
        </div>
      </div>

      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <h3 className="serif text-xl font-light tracking-tight group-hover:text-muted transition-colors line-clamp-1">{find.title}</h3>
          <div className="flex items-center gap-2">
            <p className="text-[10px] text-muted uppercase tracking-widest font-bold">{find.category || mainItem.item_summary.category}</p>
            <span className="w-1 h-1 rounded-full bg-border-custom" />
            <p className={`text-[10px] uppercase tracking-widest font-bold ${getScoreTextColor(score)}`}>{label}</p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-paper">
          <div className="flex items-center gap-3 text-muted">
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
            className="p-2 text-muted/40 hover:text-decision-red transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
};
