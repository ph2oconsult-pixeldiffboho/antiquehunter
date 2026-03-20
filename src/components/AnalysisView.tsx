import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ArrowRight, Save, ArrowLeft } from 'lucide-react';
import { BuyScoreGauge } from './BuyScoreGauge';
import { useTranslation } from 'react-i18next';

interface AnalysisViewProps {
  result: any; // Can be a single object or an array of objects
  images?: string[];
  onSave?: (status: string) => void;
  onBack: () => void;
  isSaved?: boolean;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, images = [], onSave, onBack, isSaved }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const items = Array.isArray(result) ? result : [result];
  const currentItem = items[currentIndex];

  if (!currentItem) return null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-32">
      {/* Multi-item Navigation */}
      {items.length > 1 && (
        <div className="flex items-center justify-between bg-zinc-100 p-4 rounded-3xl">
          <button 
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="p-2 disabled:opacity-30"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">Item {currentIndex + 1} of {items.length}</p>
            <p className="text-sm font-medium truncate max-w-[200px]">{currentItem.identification}</p>
          </div>
          <button 
            onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
            disabled={currentIndex === items.length - 1}
            className="p-2 disabled:opacity-30"
          >
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Hero Image & Identity */}
      <section className="space-y-8">
        <div className="flex items-center justify-between">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="px-4 py-1.5 bg-zinc-100 rounded-full flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
              {Math.round(currentItem.confidence * 100)}% {t('analysis.confidence')}
            </span>
          </div>
        </div>

        {images.length > 0 && (
          <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-6 px-6 pb-4">
            {images.map((img, index) => (
              <div key={index} className="flex-shrink-0 w-72 aspect-[4/3] rounded-[40px] overflow-hidden shadow-2xl border border-zinc-100">
                <img src={img} alt={`Antique ${index + 1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            ))}
          </div>
        )}
        
        <div className="space-y-4">
          <h1 className="serif text-4xl font-light tracking-tight">{currentItem.identification}</h1>
          <p className="text-zinc-500 leading-relaxed">{currentItem.explanation}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-6 bg-zinc-50 rounded-3xl space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{t('analysis.origin')} & {t('analysis.style')}</span>
            <p className="font-medium text-sm">{currentItem.origin} · {currentItem.style}</p>
          </div>
          <div className="p-6 bg-zinc-50 rounded-3xl space-y-1">
            <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{t('analysis.period')}</span>
            <p className="font-medium text-sm">{currentItem.period}</p>
          </div>
        </div>
      </section>

      {/* Buy Score Section */}
      <section className="p-8 bg-zinc-900 text-white rounded-[40px] shadow-xl shadow-zinc-900/20 space-y-8">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="serif text-2xl font-light">{t('analysis.buy_score')}</h2>
            <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">{currentItem.buyLabel}</p>
          </div>
          <BuyScoreGauge score={currentItem.buyScore} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-white/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Info className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.market_insight')}</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{currentItem.marketInsight}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <ArrowRight className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.price_guidance')}</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{currentItem.priceGuidance}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8 border-t border-white/10">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <Info className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.value_range')}</span>
            </div>
            <p className="text-xl font-medium">{currentItem.valueRange}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-zinc-400">
              <ArrowRight className="w-4 h-4" />
              <span className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.resale_potential')}</span>
            </div>
            <p className="text-xl font-medium">{currentItem.resalePotential}</p>
          </div>
        </div>
      </section>

      {/* Inspection Checklist */}
      <section className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-50 rounded-xl">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
          </div>
          <h2 className="serif text-2xl font-light">{t('analysis.checklist')}</h2>
        </div>
        <div className="space-y-3">
          {currentItem.checklist.map((item: string, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-5 bg-white border border-zinc-100 rounded-2xl flex items-start gap-4"
            >
              <div className="w-5 h-5 rounded-full border-2 border-zinc-200 mt-0.5" />
              <p className="text-sm font-medium text-zinc-700">{item}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Red Flags */}
      {currentItem.redFlags.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-50 rounded-xl">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
            </div>
            <h2 className="serif text-2xl font-light">{t('analysis.red_flags')}</h2>
          </div>
          <div className="space-y-3">
            {currentItem.redFlags.map((item: string, i: number) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-5 bg-rose-50/50 border border-rose-100 rounded-2xl flex items-start gap-4"
              >
                <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-rose-900">{item}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Disclaimers */}
      <p className="text-[10px] text-zinc-400 leading-relaxed text-center px-8">
        {t('analysis.disclaimer')}
      </p>

      {/* Actions */}
      {!isSaved && onSave && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-zinc-100 flex gap-4">
          <button
            onClick={onBack}
            className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-full font-medium hover:bg-zinc-200 transition-colors"
          >
            {t('common.back')}
          </button>
          <button
            onClick={() => onSave('watching')}
            className="flex-1 py-4 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 shadow-xl shadow-zinc-900/20"
          >
            <Save className="w-5 h-5" />
            {t('common.save')}
          </button>
        </div>
      )}
    </div>
  );
};
