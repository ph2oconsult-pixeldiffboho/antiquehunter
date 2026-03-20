import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ArrowRight, Save, ArrowLeft, Gavel, Handshake, OctagonX } from 'lucide-react';
import { BuyScoreGauge } from './BuyScoreGauge';
import { useTranslation } from 'react-i18next';

interface AnalysisViewProps {
  result: any; // Can be a single object or an array of objects
  images?: string[];
  onSave?: (status: string) => void;
  onBack: () => void;
  isSaved?: boolean;
  plan?: 'free' | 'pro' | 'dealer';
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, images = [], onSave, onBack, isSaved, plan = 'free' }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const items = Array.isArray(result) ? result : [result];
  const currentItem = items[currentIndex];

  if (!currentItem) return null;

  const isPro = plan === 'pro' || plan === 'dealer';
  const isDealer = plan === 'dealer';

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 65) return 'text-amber-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-rose-400';
  };

  const UpgradePlaceholder = ({ title, icon: Icon, requiredPlan }: { title: string, icon: any, requiredPlan: string }) => (
    <div className="p-6 bg-zinc-50 border border-zinc-100 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-3 text-center">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-zinc-300" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{title}</h3>
        <p className="text-xs text-zinc-500">Upgrade to <span className="text-amber-600 font-bold">{requiredPlan}</span> to unlock</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6 pb-32">
      {/* 1. Header & Navigation */}
      <header className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-zinc-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-widest rounded-full">{plan}</span>
          {items.length > 1 ? (
            <div className="flex items-center gap-4 bg-zinc-100 px-4 py-2 rounded-full">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="disabled:opacity-30"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                {currentIndex + 1} / {items.length}
              </span>
              <button 
                onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
                disabled={currentIndex === items.length - 1}
                className="disabled:opacity-30"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="px-4 py-1.5 bg-zinc-100 rounded-full flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${currentItem.item_summary.confidence === 'high' ? 'bg-emerald-500' : currentItem.item_summary.confidence === 'medium' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                {currentItem.item_summary.confidence} {t('analysis.confidence')}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* 2. Image Gallery */}
      {images.length > 0 && (
        <section className="relative group">
          <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
            {images.map((img, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.1 }}
                className="relative flex-shrink-0 w-full aspect-[4/3] rounded-[32px] overflow-hidden bg-zinc-100 snap-center border border-zinc-100"
              >
                <img 
                  src={img} 
                  alt={`Analysis ${i + 1}`}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute bottom-4 left-4 px-3 py-1 bg-black/50 backdrop-blur-md rounded-full text-[10px] text-white font-bold uppercase tracking-widest">
                  {i + 1} / {images.length}
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* 3. Item Summary Card */}
      <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
        <h1 className="serif text-3xl font-light tracking-tight leading-tight">{currentItem.item_summary.title}</h1>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Category</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.category}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Origin</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.likely_origin}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Style</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.likely_style}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Period</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.likely_period}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Confidence</p>
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${currentItem.item_summary.confidence === 'high' ? 'bg-emerald-500' : currentItem.item_summary.confidence === 'medium' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <p className="text-sm font-medium text-zinc-900 capitalize">{currentItem.item_summary.confidence}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Buy Score Card - Visually Dominant */}
      <section className="p-8 bg-zinc-900 text-white rounded-[40px] shadow-2xl shadow-zinc-900/30 space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full -mr-24 -mt-24" />
        
        <div className="flex items-center justify-between relative z-10">
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-400 uppercase tracking-[0.2em] font-bold">{t('analysis.buy_score')}</p>
            <h2 className={`serif text-4xl font-light ${getScoreColor(currentItem.buy_decision.score)}`}>{currentItem.buy_decision.label}</h2>
            <div className="flex items-center gap-2 pt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${currentItem.buy_decision.confidence === 'high' ? 'bg-emerald-500' : currentItem.buy_decision.confidence === 'medium' ? 'bg-amber-500' : 'bg-rose-500'}`} />
              <span className="text-[9px] uppercase tracking-widest font-bold text-zinc-500">{currentItem.buy_decision.confidence} Confidence</span>
            </div>
          </div>
          <BuyScoreGauge 
            score={currentItem.buy_decision.score} 
            confidence={currentItem.buy_decision.confidence}
          />
        </div>

        <div className="space-y-3 relative z-10">
          {currentItem.buy_decision.decision_summary.slice(0, 3).map((point: string, i: number) => (
            <div key={i} className="flex gap-3 items-start">
              <div className="w-1 h-1 rounded-full bg-amber-500/50 mt-2 shrink-0" />
              <p className="text-sm text-zinc-300 leading-relaxed italic">
                {point}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Price Guidance Card */}
      <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-6">
        <div className="flex items-center gap-2 text-zinc-400">
          <Info className="w-4 h-4" />
          <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.price_guidance')}</h3>
        </div>
        
        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Market Range</p>
            <p className="text-xl font-medium text-zinc-900">
              {currentItem.price_guidance.currency}{currentItem.price_guidance.estimated_market_range_low} - {currentItem.price_guidance.estimated_market_range_high}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-500/70">Good Buy Below</p>
            <p className="text-xl font-medium text-emerald-600">
              {currentItem.price_guidance.currency}{currentItem.price_guidance.good_buy_below}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Fair Price Range</p>
            <p className="text-lg font-medium text-zinc-700">
              {currentItem.price_guidance.currency}{currentItem.price_guidance.fair_price_low} - {currentItem.price_guidance.fair_price_high}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-widest font-bold text-rose-500/70">Overpaying Above</p>
            <p className="text-lg font-medium text-rose-600">
              {currentItem.price_guidance.currency}{currentItem.price_guidance.overpaying_above}
            </p>
          </div>
        </div>

        <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-50 pt-4 italic">
          {currentItem.price_guidance.pricing_reasoning}
        </p>
      </section>

      {/* 5. Dealer Take Card */}
      {isDealer ? (
        <section className="p-6 bg-zinc-50 rounded-[32px] space-y-4">
          <div className="flex items-center gap-2 text-amber-600/70">
            <Gavel className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.dealer_perspective')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Target Buy Range</p>
              <p className="text-lg font-medium text-zinc-900">
                {currentItem.price_guidance.currency}{currentItem.dealer_take.target_buy_price_low} - {currentItem.dealer_take.target_buy_price_high}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Resale Strategy</p>
              <p className="text-sm text-zinc-600 leading-relaxed">{currentItem.dealer_take.resale_strategy}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Commercial View</p>
              {currentItem.dealer_take.dealer_view.map((view: string, i: number) => (
                <p key={i} className="text-sm text-zinc-600 leading-relaxed flex gap-2">
                  <span className="text-amber-500">•</span> {view}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <UpgradePlaceholder title={t('analysis.dealer_perspective')} icon={Gavel} requiredPlan="Dealer" />
      )}

      {/* 6. Negotiation Strategy Card */}
      {isPro ? (
        <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600/70">
            <Handshake className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.negotiation_strategy')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50/50 rounded-2xl">
              <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-600/70 mb-1">Opening Offer</p>
              <p className="text-lg font-bold text-emerald-700">{currentItem.price_guidance.currency}{currentItem.negotiation_strategy.opening_offer}</p>
            </div>
            <div className="p-4 bg-zinc-50 rounded-2xl">
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Target Range</p>
              <p className="text-lg font-bold text-zinc-700">{currentItem.price_guidance.currency}{currentItem.negotiation_strategy.target_price_low}-{currentItem.negotiation_strategy.target_price_high}</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Key Points to Raise</p>
            {currentItem.negotiation_strategy.points_to_raise.map((point: string, i: number) => (
              <p key={i} className="text-sm text-zinc-600 leading-relaxed flex gap-2">
                <span className="text-emerald-500">→</span> {point}
              </p>
            ))}
          </div>
        </section>
      ) : (
        <UpgradePlaceholder title={t('analysis.negotiation_strategy')} icon={Handshake} requiredPlan="Pro" />
      )}

      {/* 7. Walk Away Card */}
      <section className="p-6 bg-rose-50/50 border border-rose-100 rounded-[32px] space-y-4">
        <div className="flex items-center gap-2 text-rose-600">
          <OctagonX className="w-4 h-4" />
          <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.when_to_walk_away')}</h3>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-bold text-rose-900">Walk away if price exceeds {currentItem.price_guidance.currency}{currentItem.negotiation_strategy.walk_away_price}</p>
          <div className="space-y-2">
            {currentItem.walk_away_if.slice(0, 3).map((condition: string, i: number) => (
              <p key={i} className="text-sm text-rose-800 leading-relaxed flex gap-2">
                <span className="text-rose-400 font-bold">!</span> {condition}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* 8. Top 3 Checks Card */}
      <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-zinc-400">
          <CheckCircle className="w-4 h-4" />
          <h3 className="text-[10px] uppercase tracking-widest font-bold">Top 3 Quick Checks</h3>
        </div>
        <div className="space-y-3">
          {currentItem.top_checks.slice(0, 3).map((check: string, i: number) => (
            <div key={i} className="flex items-center gap-4 p-3 bg-zinc-50 rounded-2xl">
              <div className="w-6 h-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                {i + 1}
              </div>
              <p className="text-sm font-medium text-zinc-700">{check}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 9. Red Flags Card */}
      {currentItem.red_flags.length > 0 && (
        <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-rose-500">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.red_flags')}</h3>
          </div>
          <div className="space-y-3">
            {currentItem.red_flags.map((flag: any, i: number) => (
              <div key={i} className="p-4 bg-zinc-50 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                    flag.severity === 'high' ? 'bg-rose-100 text-rose-600' :
                    flag.severity === 'medium' ? 'bg-amber-100 text-amber-600' :
                    'bg-zinc-200 text-zinc-600'
                  }`}>
                    {flag.severity}
                  </span>
                </div>
                <p className="text-sm font-bold text-zinc-900">{flag.issue}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{flag.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 10. Market Insight Card */}
      {isPro ? (
        <section className="p-6 bg-zinc-50 rounded-[32px] space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.market_insight')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Demand</p>
              <p className="text-sm font-medium text-zinc-900 capitalize">{currentItem.market_insight.demand}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Resale Ease</p>
              <p className="text-sm font-medium text-zinc-900 capitalize">{currentItem.market_insight.resale_ease.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Value Drivers</p>
            <div className="flex flex-wrap gap-2">
              {currentItem.market_insight.drivers_of_value.map((driver: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-white border border-zinc-100 rounded-full text-[10px] text-zinc-600">
                  {driver}
                </span>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <UpgradePlaceholder title={t('analysis.market_insight')} icon={Info} requiredPlan="Pro" />
      )}

      {/* 11. Disclaimer */}
      <p className="text-[10px] text-zinc-400 leading-relaxed text-center px-8 pt-4">
        {currentItem.disclaimer}
      </p>

      {/* 12. Sticky Bottom Action Bar */}
      {!isSaved && onSave && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-zinc-100 flex gap-4 z-50">
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
