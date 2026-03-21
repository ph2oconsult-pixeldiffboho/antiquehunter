import React from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ArrowRight, Save, ArrowLeft, Gavel, Handshake, OctagonX, Share2 } from 'lucide-react';
import { BuyScoreGauge } from './BuyScoreGauge';
import { useTranslation } from 'react-i18next';

interface AnalysisViewProps {
  result: any; // Can be a single object or an array of objects
  images?: string[];
  onSave?: (status: string) => void;
  onBack: () => void;
  onUpgrade?: (plan: 'pro') => void;
  isSaved?: boolean;
  plan?: 'free' | 'pro' | 'dealer';
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, images = [], onSave, onBack, onUpgrade, isSaved, plan = 'free' }) => {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const items = Array.isArray(result) ? result : [result];
  const currentItem = items[currentIndex];

  if (!currentItem) return null;

  const isPro = plan === 'pro' || plan === 'dealer';
  const isDealer = plan === 'dealer';
  const isFree = plan === 'free';

  // Value Tier logic: Tier D (Utility) items bypass paywall
  const isTierD = currentItem.item_summary?.value_tier === 'D';
  const showPaywall = isFree && !isTierD;

  // Content visibility logic
  const showProContent = isPro || isTierD;
  const showDealerContent = isDealer || isTierD;
  const isHardPass = currentItem.buy_decision.score < 25;

  const [copied, setCopied] = React.useState(false);

  const handleShare = async () => {
    const text = isHardPass 
      ? `Dealer Warning: This item is a Hard Pass (Score: ${currentItem.buy_decision.score}). ${currentItem.item_summary.snap_judgement}`
      : `Antique Hunter Alert: This ${currentItem.item_summary.title} is a Tier D utility item. ${currentItem.item_summary.snap_judgement}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Antique Hunter Analysis',
          text: text,
          url: window.location.href
        });
      } catch (err) {
        console.error('Error sharing:', err);
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const ShareButton = ({ className = "" }: { className?: string }) => (
    <button 
      onClick={handleShare}
      className={`flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full border border-white/20 transition-colors text-[10px] font-bold uppercase tracking-widest text-white/80 ${className}`}
    >
      <Share2 className="w-3 h-3" />
      {copied ? "Copied!" : (isHardPass ? t('paywall.share_warning') : t('paywall.send_to_friend'))}
    </button>
  );

  const getDecisionStyles = (score: number) => {
    if (score >= 80) { // Strong Buy
      return {
        text: 'text-emerald-400',
        accent: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-500',
        cardBg: 'bg-zinc-900',
        blur: 'bg-emerald-500/10'
      };
    }
    if (score >= 65) { // Buy
      return {
        text: 'text-emerald-400',
        accent: 'bg-emerald-500/10',
        border: 'border-emerald-500/20',
        dot: 'bg-emerald-500',
        cardBg: 'bg-zinc-900',
        blur: 'bg-emerald-500/10'
      };
    }
    if (score >= 45) { // Risky
      return {
        text: 'text-rose-400',
        accent: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        dot: 'bg-rose-500',
        cardBg: 'bg-zinc-900',
        blur: 'bg-rose-500/10'
      };
    }
    if (score >= 25) { // Avoid
      return {
        text: 'text-rose-400',
        accent: 'bg-rose-500/10',
        border: 'border-rose-500/20',
        dot: 'bg-rose-500',
        cardBg: 'bg-zinc-900',
        blur: 'bg-rose-500/10'
      };
    }
    // Hard Pass
    return {
      text: 'text-rose-600',
      accent: 'bg-rose-900/40',
      border: 'border-rose-900/50',
      dot: 'bg-rose-600',
      cardBg: 'bg-zinc-950', // Darker tone for Hard Pass
      blur: 'bg-rose-600/20'
    };
  };

  const decisionStyles = getDecisionStyles(currentItem.buy_decision.score);

  const PaywallCard = () => (
    <section className={`p-10 ${decisionStyles.cardBg} text-white rounded-[44px] shadow-2xl shadow-zinc-900/40 space-y-10 relative overflow-hidden transition-all duration-500 border border-white/5`}>
      <div className={`absolute top-0 right-0 w-80 h-80 ${decisionStyles.blur} blur-[120px] rounded-full -mr-40 -mt-40 transition-colors duration-500`} />
      
      <div className="relative z-10 space-y-8 text-center">
        <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${decisionStyles.accent} rounded-full border ${decisionStyles.border}`}>
          <ShieldAlert className={`w-3.5 h-3.5 ${decisionStyles.text}`} />
          <span className={`text-[11px] font-bold uppercase tracking-widest ${decisionStyles.text}`}>{t('paywall.urgency')}</span>
        </div>
        
        <div className="space-y-4">
          <h2 className="serif text-4xl font-light leading-tight">
            {t('paywall.title')}
          </h2>
          <p className="text-zinc-400 text-base font-light italic leading-relaxed max-w-[280px] mx-auto">
            {t('paywall.benefit_line')}
          </p>
          <p className="text-zinc-300 text-sm font-medium">
            {t('paywall.subtitle')}
          </p>
        </div>

        <div className="space-y-2 py-4 border-y border-white/10">
          <p className={`${decisionStyles.text} text-2xl font-bold leading-tight tracking-tight`}>
            {t('paywall.tension_line_title')}
          </p>
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider">
            {t('paywall.tension_line_subtitle')}
          </p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => onUpgrade?.('pro')}
            className="w-full py-5 bg-gradient-to-r from-amber-500 to-amber-600 text-zinc-900 rounded-full font-bold hover:from-amber-400 hover:to-amber-500 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-amber-500/40 border border-amber-400/20 flex items-center justify-center gap-3 group"
          >
            <span className="text-lg">{t('paywall.cta')}</span>
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </button>
          <p className="text-[11px] text-zinc-500 font-medium tracking-wide">
            {t('paywall.cta_footer')}
          </p>
        </div>
      </div>
    </section>
  );

  const UpgradePlaceholder = ({ title, description, icon: Icon, requiredPlan }: { title: string, description: string, icon: any, requiredPlan: string }) => (
    <div className="p-6 bg-zinc-50 border border-zinc-100 border-dashed rounded-[32px] flex flex-col items-center justify-center gap-3 text-center opacity-60">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-zinc-300" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{title}</h3>
        <p className="text-sm font-medium text-zinc-900 leading-tight">{description}</p>
        <p className={`text-[10px] ${decisionStyles.text} font-bold pt-1 uppercase tracking-tighter`}>Unlock {title}</p>
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
            <div className="flex flex-col items-end gap-1">
              <div className="px-4 py-1.5 bg-zinc-100 rounded-full flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  currentItem.item_summary.confidence === 'high' ? 'bg-emerald-500' : 
                  currentItem.item_summary.confidence === 'medium' ? 'bg-zinc-400' : 
                  currentItem.item_summary.confidence === 'low' ? 'bg-rose-500/80' : 'bg-rose-600'
                }`} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                  {currentItem.item_summary.confidence.replace('_', ' ')} {t('analysis.confidence')}
                </span>
              </div>
              <div className="w-24 h-0.5 bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out rounded-full ${
                    currentItem.item_summary.confidence === 'high' ? 'bg-emerald-500' : 
                    currentItem.item_summary.confidence === 'medium' ? 'bg-zinc-400' : 
                    currentItem.item_summary.confidence === 'low' ? 'bg-rose-500/80' : 'bg-rose-600'
                  }`}
                  style={{ width: `${currentItem.item_summary.confidence_score}%` }}
                />
              </div>
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

      {/* 2. Buy Score Card - Visually Dominant & First Priority */}
      <div className="space-y-6">
        {showPaywall ? (
          <PaywallCard />
        ) : (
          <section className={`p-10 ${decisionStyles.cardBg} text-white rounded-[44px] shadow-2xl shadow-zinc-900/40 space-y-10 relative overflow-hidden transition-all duration-500 border border-white/5`}>
            <div className={`absolute top-0 right-0 w-64 h-64 ${decisionStyles.blur} blur-[100px] rounded-full -mr-32 -mt-32 transition-colors duration-500`} />
            
            {isTierD && isFree && (
              <div className="relative z-10 px-6 py-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 mb-6">
                <p className="text-sm font-medium text-amber-400 leading-relaxed italic">
                  {t('paywall.low_value_notice')}
                </p>
                <p className="text-[11px] font-bold text-white/60 mt-1 uppercase tracking-wider">
                  {t('paywall.value_anchor', { 
                    currency: currentItem.price_guidance.currency, 
                    low: currentItem.price_guidance.estimated_market_range_low, 
                    high: currentItem.price_guidance.estimated_market_range_high 
                  })}
                </p>
                <div className="mt-4">
                  <ShareButton />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-[11px] text-zinc-400 uppercase tracking-[0.3em] font-bold">{t('analysis.buy_score')}</p>
                <h2 className={`serif text-5xl font-light tracking-tight ${decisionStyles.text}`}>{currentItem.buy_decision.label}</h2>
                <div className="flex items-center gap-2 pt-1">
                  <div className={`w-2 h-2 rounded-full ${decisionStyles.dot}`} />
                  <span className="text-[10px] uppercase tracking-widest font-bold text-zinc-500">
                    {currentItem.buy_decision.confidence.replace('_', ' ')} Certainty
                  </span>
                </div>
              </div>
              <div className="scale-125 origin-right">
                <BuyScoreGauge 
                  score={currentItem.buy_decision.score} 
                  confidence={currentItem.buy_decision.confidence}
                />
              </div>
            </div>

            {/* Integrated Snap Judgement */}
            <div className="relative z-10 py-6 border-y border-white/10">
              <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-2">{t('analysis.snap_judgement')}</p>
              <p className="serif text-2xl font-medium text-white italic leading-snug">
                "{currentItem.item_summary.snap_judgement}"
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              <div className={`p-5 bg-white/5 rounded-3xl border ${decisionStyles.border}`}>
                <p className={`text-[11px] uppercase tracking-widest font-bold ${decisionStyles.text} mb-1`}>Hard Limit</p>
                <p className="text-xl font-medium">Hard ceiling: {currentItem.price_guidance.currency}{currentItem.price_guidance.overpaying_above}</p>
              </div>
              <div className="space-y-4">
                {currentItem.buy_decision.decision_summary.slice(0, 3).map((point: string, i: number) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className={`w-1.5 h-1.5 rounded-full ${decisionStyles.dot} opacity-50 mt-2 shrink-0`} />
                    <p className="text-base text-zinc-300 leading-relaxed italic font-light">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
              {isHardPass && (
                <div className="pt-4">
                  <ShareButton className="w-full justify-center py-4 text-xs" />
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* 3. Item Summary Card */}
      <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
        <h1 className="serif text-3xl font-light tracking-tight leading-tight">{currentItem.item_summary.title}</h1>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Type</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.category}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Provenance</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.likely_origin}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Aesthetic</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.likely_style}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Era</p>
            <p className="text-sm font-medium text-zinc-900">{currentItem.item_summary.likely_period}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Certainty</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    currentItem.item_summary.confidence === 'high' ? 'bg-emerald-500' : 
                    currentItem.item_summary.confidence === 'medium' ? 'bg-zinc-400' : 
                    currentItem.item_summary.confidence === 'low' ? 'bg-rose-500/80' : 'bg-rose-600'
                  }`} />
                  <p className="text-sm font-medium text-zinc-900 capitalize">
                    {currentItem.item_summary.confidence.replace('_', ' ')}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-zinc-400">{currentItem.item_summary.confidence_score}%</span>
              </div>
              
              {/* Minimal Confidence Meter */}
              <div className="h-1 w-full bg-zinc-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out rounded-full ${
                    currentItem.item_summary.confidence === 'high' ? 'bg-emerald-500' : 
                    currentItem.item_summary.confidence === 'medium' ? 'bg-zinc-400' : 
                    currentItem.item_summary.confidence === 'low' ? 'bg-rose-500/80' : 'bg-rose-600'
                  }`}
                  style={{ width: `${currentItem.item_summary.confidence_score}%` }}
                />
              </div>

              {currentItem.item_summary.confidence_reason && (
                <p className="text-[10px] text-zinc-500 leading-tight italic">
                  {currentItem.item_summary.confidence_reason}
                </p>
              )}
              {currentItem.item_summary.confidence_improvement_suggestions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-50 space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">How to increase confidence</p>
                  <ul className="space-y-1">
                    {currentItem.item_summary.confidence_improvement_suggestions.map((suggestion: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-zinc-300 mt-1.5 shrink-0" />
                        <p className="text-[10px] text-zinc-600 font-medium leading-tight">{suggestion}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Teaser Insight for Free Users */}
      {showPaywall && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-1">{t('analysis.preliminary_findings')}</h3>
            
            {currentItem.teaser_insight && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-6 py-4 bg-rose-50/80 border border-rose-200 rounded-2xl flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-rose-700/80">Dealer's Warning</p>
                  <p className="text-sm font-medium text-rose-900 leading-relaxed">
                    {currentItem.teaser_insight}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Trust Builders: One Check & One Red Flag */}
            <div className="grid grid-cols-1 gap-3">
              {currentItem.top_checks?.[0] && (
                <div className="p-4 bg-white border border-zinc-100 rounded-2xl flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  <p className="text-xs font-medium text-zinc-600">
                    <span className="text-zinc-400 mr-1">Inspection:</span> {currentItem.top_checks[0]}
                  </p>
                </div>
              )}
              {currentItem.red_flags?.[0] && (
                <div className="p-4 bg-white border border-zinc-100 rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                  <p className="text-xs font-medium text-zinc-600">
                    <span className="text-zinc-400 mr-1">Flag:</span> {currentItem.red_flags[0].issue}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 4. Price Guidance Card */}
      {showPaywall ? (
        <UpgradePlaceholder 
          title={t('analysis.price_guidance')} 
          description="See the real price vs what sellers ask"
          icon={Info} 
          requiredPlan="Pro" 
        />
      ) : (
        <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.price_guidance')}</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Market Reality</p>
              <p className="text-xl font-medium text-zinc-900">
                {currentItem.price_guidance.currency}{currentItem.price_guidance.estimated_market_range_low} - {currentItem.price_guidance.estimated_market_range_high}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-500/70">Safe Entry</p>
              <p className="text-xl font-medium text-emerald-600">
                {currentItem.price_guidance.currency}{currentItem.price_guidance.good_buy_below}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Retail Range</p>
              <p className="text-lg font-medium text-zinc-700">
                {currentItem.price_guidance.currency}{currentItem.price_guidance.fair_price_low} - {currentItem.price_guidance.fair_price_high}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-rose-600/80">Danger Zone</p>
              <p className="text-lg font-medium text-rose-600">
                {currentItem.price_guidance.currency}{currentItem.price_guidance.overpaying_above}
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 leading-relaxed border-t border-zinc-50 pt-4 italic">
            {currentItem.price_guidance.pricing_reasoning}
          </p>
        </section>
      )}

      {/* 5. Dealer Take Card */}
      {showDealerContent ? (
        <section className="p-6 bg-zinc-50 rounded-[32px] space-y-4">
          <div className="flex items-center gap-2 text-amber-600/70">
            <Gavel className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.dealer_perspective')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Dealer's Buy</p>
              <p className="text-lg font-medium text-zinc-900">
                {currentItem.price_guidance.currency}{currentItem.dealer_take.target_buy_price_low} - {currentItem.dealer_take.target_buy_price_high}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Exit Strategy</p>
              <p className="text-sm text-zinc-600 leading-relaxed">{currentItem.dealer_take.resale_strategy}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Trade Assessment</p>
              {currentItem.dealer_take.dealer_view.map((view: string, i: number) => (
                <p key={i} className="text-sm text-zinc-600 leading-relaxed flex gap-2">
                  <span className="text-amber-500">•</span> {view}
                </p>
              ))}
            </div>
          </div>
        </section>
      ) : (
        <UpgradePlaceholder 
          title={t('analysis.dealer_perspective')} 
          description="How a dealer would actually position this piece"
          icon={Gavel} 
          requiredPlan="Dealer" 
        />
      )}

      {/* 6. Negotiation Strategy Card */}
      {showProContent ? (
        <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-emerald-600/70">
            <Handshake className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.negotiation_strategy')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-emerald-50/50 rounded-2xl">
              <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-600/70 mb-1">First Bid</p>
              <p className="text-lg font-bold text-emerald-700">{currentItem.price_guidance.currency}{currentItem.negotiation_strategy.opening_offer}</p>
            </div>
            <div className="p-4 bg-zinc-50 rounded-2xl">
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-1">Closing Target</p>
              <p className="text-lg font-bold text-zinc-700">{currentItem.price_guidance.currency}{currentItem.negotiation_strategy.target_price_low}-{currentItem.negotiation_strategy.target_price_high}</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">Leverage Points</p>
            {currentItem.negotiation_strategy.points_to_raise.map((point: string, i: number) => (
              <p key={i} className="text-sm text-zinc-600 leading-relaxed flex gap-2">
                <span className="text-emerald-500">→</span> {point}
              </p>
            ))}
          </div>
        </section>
      ) : (
        <UpgradePlaceholder 
          title={t('analysis.negotiation_strategy')} 
          description="Exact offer range and negotiation strategy"
          icon={Handshake} 
          requiredPlan="Pro" 
        />
      )}

      {/* 7. Walk Away Card */}
      {showPaywall ? (
        <UpgradePlaceholder 
          title={t('analysis.when_to_walk_away')} 
          description="Conditions that make this a bad buy"
          icon={OctagonX} 
          requiredPlan="Pro" 
        />
      ) : (
        <section className="p-6 bg-rose-50/50 border border-rose-200 rounded-[32px] space-y-4">
          <div className="flex items-center gap-2 text-rose-700">
            <OctagonX className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-80">{t('analysis.when_to_walk_away')}</h3>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-rose-900">Walk-away price: {currentItem.price_guidance.currency}{currentItem.negotiation_strategy.walk_away_price}</p>
            <div className="space-y-2">
              {currentItem.walk_away_if.slice(0, 3).map((condition: string, i: number) => (
                <p key={i} className="text-sm text-rose-800 leading-relaxed flex gap-2">
                  <span className="text-rose-500 font-bold">!</span> {condition}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. Top 3 Checks Card */}
      {!showPaywall && (
        <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <CheckCircle className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.checklist')}</h3>
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
      )}

      {/* 9. Red Flags Card */}
      {!showPaywall && currentItem.red_flags.length > 0 && (
        <section className="p-6 bg-white border border-zinc-100 rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-rose-600">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.red_flags')}</h3>
          </div>
          <div className="space-y-3">
            {currentItem.red_flags.map((flag: any, i: number) => (
              <div key={i} className={`p-4 rounded-2xl space-y-2 border ${
                flag.severity === 'high' ? 'bg-rose-50/80 border-rose-200/60' :
                flag.severity === 'medium' ? 'bg-rose-50/50 border-rose-100/50' :
                'bg-zinc-50 border-zinc-100'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                    flag.severity === 'high' ? 'bg-rose-100 text-rose-700' :
                    flag.severity === 'medium' ? 'bg-rose-50 text-rose-600' :
                    'bg-zinc-200 text-zinc-600'
                  }`}>
                    {flag.severity}
                  </span>
                </div>
                <p className="text-sm font-bold text-zinc-900">{flag.issue}</p>
                <p className="text-xs text-zinc-600 leading-relaxed">{flag.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 10. Market Insight Card */}
      {showProContent ? (
        <section className="p-6 bg-zinc-50 rounded-[32px] space-y-4">
          <div className="flex items-center gap-2 text-zinc-400">
            <Info className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.market_insight')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Appetite</p>
              <p className="text-sm font-medium text-zinc-900 capitalize">{currentItem.market_insight.demand}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400 mb-0.5">Liquidity</p>
              <p className="text-sm font-medium text-zinc-900 capitalize">{currentItem.market_insight.resale_ease.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[9px] uppercase tracking-widest font-bold text-zinc-400">What Sells This</p>
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
        <UpgradePlaceholder 
          title={t('analysis.market_insight')} 
          description="How strong demand is and what actually drives value"
          icon={Info} 
          requiredPlan="Pro" 
        />
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
