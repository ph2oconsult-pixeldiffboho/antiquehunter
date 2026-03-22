import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle, Info, ShieldAlert, ArrowRight, Save, ArrowLeft, Gavel, Handshake, OctagonX, Share2 } from 'lucide-react';
import { BuyScoreGauge } from './BuyScoreGauge';
import { useTranslation } from 'react-i18next';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface AnalysisViewProps {
  result: any; // Can be a single object or an array of objects
  images?: string[];
  onSave?: (status: string) => void;
  onBack: () => void;
  onUpgrade?: (packId: string) => void;
  isSaved?: boolean;
  plan?: 'free' | 'pro' | 'dealer' | string;
  currency: string;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, images = [], onSave, onBack, onUpgrade, isSaved, plan = 'free', currency }) => {
  const { t, i18n } = useTranslation();
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const formatPrice = (amount: number) => {
    const displayCurrency = currentItem?.price_guidance?.currency || currency;
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: displayCurrency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', JPY: '¥' };
      return `${symbols[displayCurrency] || '$'}${amount}`;
    }
  };

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
    if (score >= 65) { // Buy & Strong Buy
      return {
        text: 'text-decision-green',
        accent: 'bg-decision-green/10',
        border: 'border-decision-green/20',
        dot: 'bg-decision-green',
        cardBg: 'bg-card',
        blur: 'bg-decision-green/10'
      };
    }
    if (score >= 45) { // Risky
      return {
        text: 'text-decision-gold',
        accent: 'bg-decision-gold/10',
        border: 'border-decision-gold/20',
        dot: 'bg-decision-gold',
        cardBg: 'bg-card',
        blur: 'bg-decision-gold/10'
      };
    }
    // Avoid & Hard Pass
    return {
      text: 'text-decision-red',
      accent: 'bg-decision-red/10',
      border: 'border-decision-red/20',
      dot: 'bg-decision-red',
      cardBg: 'bg-card',
      blur: 'bg-decision-red/10'
    };
  };

  const decisionStyles = getDecisionStyles(currentItem.buy_decision.score);

  const getContextualPaywallMessage = () => {
    const category = currentItem.item_summary?.category?.toLowerCase() || '';
    const score = currentItem.buy_decision?.score || 50;

    if (score < 45) {
      return "This category is often overpriced by inexperienced buyers";
    }
    if (category.includes('furniture') || category.includes('ceramic') || category.includes('china')) {
      return "Value is highly condition-dependent";
    }
    if (category.includes('art') || category.includes('painting') || category.includes('jewelry')) {
      return "Small details will significantly impact price";
    }
    return t('paywall.description');
  };

  const contextualMessage = getContextualPaywallMessage();

  const [selectedPack, setSelectedPack] = useState('3pack');

  const getPackPrices = (currencyCode: string) => {
    const prices: Record<string, any> = {
      GBP: { 
        single: '£4.99', 
        pack3: '£9.99', 
        pack10: '£29.99', 
        singlePer: '£4.99/ea', 
        pack3Per: '£3.33/ea', 
        pack10Per: '£2.99/ea',
        pack3Label: 'Best value',
        pack10Label: 'Best for regular buyers'
      },
      USD: { 
        single: '$6.99', 
        pack3: '$13.99', 
        pack10: '$39.99', 
        singlePer: '$6.99/ea', 
        pack3Per: '$4.66/ea', 
        pack10Per: '$3.99/ea' 
      },
      EUR: { 
        single: '€5.99', 
        pack3: '€11.99', 
        pack10: '€34.99', 
        singlePer: '€5.99/ea', 
        pack3Per: '€3.99/ea', 
        pack10Per: '€3.49/ea' 
      },
      AUD: { 
        single: 'A$9.99', 
        pack3: 'A$19.99', 
        pack10: 'A$59.99', 
        singlePer: 'A$9.99/ea', 
        pack3Per: 'A$6.66/ea', 
        pack10Per: 'A$5.99/ea' 
      },
    };
    return prices[currencyCode] || prices.USD;
  };

  const currentPackPrices = getPackPrices(currency);

  const packs = [
    { 
      id: 'single', 
      title: t('paywall.pack_single_title'), 
      price: currentPackPrices.single, 
      per: currentPackPrices.singlePer 
    },
    { 
      id: '3pack', 
      title: t('paywall.pack_3_title'), 
      price: currentPackPrices.pack3, 
      per: currentPackPrices.pack3Per, 
      featured: true,
      label: currentPackPrices.pack3Label || t('paywall.best_value')
    },
    { 
      id: '10pack', 
      title: t('paywall.pack_10_title'), 
      price: currentPackPrices.pack10, 
      per: currentPackPrices.pack10Per,
      label: currentPackPrices.pack10Label
    },
  ];

  const handleCheckout = (packId: string) => {
    // Call the upgrade function with the selected pack
    onUpgrade?.(packId as any);
  };

  const PaywallCard = () => (
    <section className={`p-8 sm:p-10 ${decisionStyles.cardBg} text-white rounded-[44px] shadow-2xl shadow-ink/40 space-y-10 relative overflow-hidden transition-all duration-500 border border-white/5`}>
      <div className={`absolute top-0 right-0 w-80 h-80 ${decisionStyles.blur} blur-[120px] rounded-full -mr-40 -mt-40 transition-colors duration-500`} />
      
      <div className="relative z-10 space-y-8">
        <div className="text-center space-y-6">
          <div className={`inline-flex items-center gap-2 px-4 py-1.5 ${decisionStyles.accent} rounded-full border ${decisionStyles.border}`}>
            <ShieldAlert className={`w-3.5 h-3.5 ${decisionStyles.text}`} />
            <span className={`text-[11px] font-bold uppercase tracking-widest ${decisionStyles.text}`}>{t('paywall.urgency')}</span>
          </div>
          
          <div className="space-y-4">
            <h2 className="serif text-3xl sm:text-4xl font-light leading-tight">
              {t('paywall.title')}
            </h2>
            <p className="text-gold text-base font-bold italic leading-relaxed max-w-[280px] mx-auto">
              “{contextualMessage}”
            </p>
          </div>
        </div>

        {/* Pricing Options */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {packs.map((pack) => (
            <motion.div
              key={pack.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedPack(pack.id)}
              className={`relative p-6 rounded-3xl border-2 transition-all cursor-pointer flex flex-col items-center text-center gap-2 ${
                selectedPack === pack.id 
                  ? 'border-gold bg-gold/10' 
                  : pack.featured
                    ? 'border-gold/30 bg-gold/5 hover:border-gold/50'
                    : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              {pack.label && (
                <div className={`absolute -top-3 left-1/2 -translate-x-1/2 ${pack.featured ? 'bg-gold text-ink' : 'bg-white/10 text-white/60 border border-white/10'} text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-lg whitespace-nowrap`}>
                  {pack.label}
                </div>
              )}
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-60">{pack.title}</h3>
              <div className="text-2xl font-bold">{pack.price}</div>
              <div className="text-[10px] opacity-40 font-medium">{pack.per}</div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4 pt-4">
          <button 
            onClick={() => handleCheckout(selectedPack)}
            className="w-full py-5 bg-gold text-ink rounded-full font-bold hover:opacity-90 transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-2xl shadow-gold/40 border border-gold/20 flex flex-col items-center justify-center gap-0.5 group"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{t('paywall.cta')}</span>
              <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </div>
            <span className="text-[10px] uppercase tracking-widest font-bold opacity-60">
              {t('paywall.cta_strategy')}
            </span>
          </button>
          <p className="text-[11px] text-muted font-medium tracking-wide text-center">
            {t('paywall.cta_footer')}
          </p>
        </div>
      </div>
    </section>
  );

  const UpgradePlaceholder = ({ title, description, icon: Icon, requiredPlan }: { title: string, description: string, icon: any, requiredPlan: string }) => (
    <div className="p-6 bg-paper border border-border-custom border-dashed rounded-[32px] flex flex-col items-center justify-center gap-3 text-center opacity-60">
      <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
        <Icon className="w-5 h-5 text-muted" />
      </div>
      <div className="space-y-1">
        <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted">{title}</h3>
        <p className="text-sm font-medium text-ink leading-tight">{description}</p>
        <p className={`text-[10px] ${decisionStyles.text} font-bold pt-1 uppercase tracking-tighter`}>Unlock {title}</p>
      </div>
    </div>
  );

  const FeedbackSection = ({ currentItem }: { currentItem: any }) => {
    const { t } = useTranslation();
    const [outcome, setOutcome] = useState<'bought' | 'not_bought' | 'still_deciding' | null>(null);
    const [pricePaid, setPricePaid] = useState('');
    const [reason, setReason] = useState<string | null>(null);
    const [helpful, setHelpful] = useState<boolean | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
      if (submitted) {
        const timer = setTimeout(() => {
          onBack();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }, [submitted]);

    const handleSubmit = async () => {
      if (outcome === null || helpful === null) return;
      if (outcome === 'not_bought' && !reason) return;
      
      setLoading(true);
      try {
        const feedbackData = {
          userId: auth.currentUser?.uid || 'anonymous',
          itemCategory: currentItem.item_summary.category,
          predictedPriceRange: {
            low: currentItem.price_guidance.estimated_market_range_low,
            high: currentItem.price_guidance.estimated_market_range_high
          },
          confidenceLevel: currentItem.item_summary.confidence,
          confidenceScore: currentItem.item_summary.confidence_score,
          userAction: outcome,
          pricePaid: outcome === 'bought' ? parseFloat(pricePaid) || null : null,
          notBoughtReason: outcome === 'not_bought' ? reason : null,
          isHelpful: helpful,
          timestamp: serverTimestamp(),
          itemId: currentItem.item_summary.title,
          currency: currentItem.price_guidance.currency || currency
        };

        await addDoc(collection(db, 'analysis_feedback'), feedbackData);
        setSubmitted(true);
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, 'analysis_feedback');
      } finally {
        setLoading(false);
      }
    };

    if (submitted) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-decision-green/5 border border-decision-green/20 rounded-[44px] text-center space-y-2"
        >
          <CheckCircle className="w-8 h-8 text-decision-green mx-auto" />
          <p className="text-sm font-bold text-decision-green">{t('feedback.thanks')}</p>
        </motion.div>
      );
    }

    return (
      <section className="p-8 bg-white border border-border-custom rounded-[44px] shadow-sm space-y-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-muted">
            <Info className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('feedback.title')}</h3>
          </div>
          <p className="text-sm text-muted font-medium">{t('feedback.subtitle')}</p>
        </div>

        <div className="space-y-6">
          {/* Question 1: What happened? */}
          <div className="space-y-3">
            <p className="text-sm font-bold text-ink">{t('feedback.outcome_question')}</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'bought', label: t('feedback.bought') },
                { id: 'not_bought', label: t('feedback.not_bought') },
                { id: 'still_deciding', label: t('feedback.still_deciding') }
              ].map((opt) => (
                <button 
                  key={opt.id}
                  onClick={() => {
                    setOutcome(opt.id as any);
                    setReason(null);
                    setHelpful(null);
                  }}
                  className={`px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all ${outcome === opt.id ? 'bg-gold border-gold text-ink' : 'bg-paper border-border-custom text-muted hover:border-gold/30'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditional: Bought it */}
          {outcome === 'bought' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-3">
                <p className="text-sm font-bold text-ink">{t('feedback.price_paid_label')}</p>
                <input 
                  type="number"
                  value={pricePaid}
                  onChange={(e) => setPricePaid(e.target.value)}
                  placeholder={t('feedback.price_paid_placeholder')}
                  className="w-full px-5 py-3 bg-paper border border-border-custom rounded-2xl text-sm font-medium focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-ink">{t('feedback.helpful_question')}</p>
                <div className="flex gap-2">
                  {[
                    { id: true, label: t('feedback.yes') },
                    { id: false, label: t('feedback.no') }
                  ].map((opt) => (
                    <button 
                      key={String(opt.id)}
                      onClick={() => setHelpful(opt.id)}
                      className={`flex-1 py-2.5 rounded-2xl border text-xs font-bold transition-all ${helpful === opt.id ? 'bg-gold border-gold text-ink' : 'bg-paper border-border-custom text-muted'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Conditional: Didn't buy */}
          {outcome === 'not_bought' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-6 pt-2"
            >
              <div className="space-y-3">
                <p className="text-sm font-bold text-ink">{t('feedback.why_not_bought_question')}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'too_expensive', label: t('feedback.reason_expensive') },
                    { id: 'no_trust', label: t('feedback.reason_trust') },
                    { id: 'condition_issue', label: t('feedback.reason_condition') },
                    { id: 'seller_issue', label: t('feedback.reason_seller') },
                    { id: 'other', label: t('feedback.reason_other') }
                  ].map((opt) => (
                    <button 
                      key={opt.id}
                      onClick={() => setReason(opt.id)}
                      className={`px-4 py-2 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all ${reason === opt.id ? 'bg-gold border-gold text-ink' : 'bg-paper border-border-custom text-muted'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-bold text-ink">{t('feedback.helpful_question')}</p>
                <div className="flex gap-2">
                  {[
                    { id: true, label: t('feedback.yes') },
                    { id: false, label: t('feedback.no') }
                  ].map((opt) => (
                    <button 
                      key={String(opt.id)}
                      onClick={() => setHelpful(opt.id)}
                      className={`flex-1 py-2.5 rounded-2xl border text-xs font-bold transition-all ${helpful === opt.id ? 'bg-gold border-gold text-ink' : 'bg-paper border-border-custom text-muted'}`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Conditional: Still deciding */}
          {outcome === 'still_deciding' && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-3 pt-2"
            >
              <p className="text-sm font-bold text-ink">{t('feedback.helpful_so_far_question')}</p>
              <div className="flex gap-2">
                {[
                  { id: true, label: t('feedback.yes') },
                  { id: false, label: t('feedback.no') }
                ].map((opt) => (
                  <button 
                    key={String(opt.id)}
                    onClick={() => setHelpful(opt.id)}
                    className={`flex-1 py-2.5 rounded-2xl border text-xs font-bold transition-all ${helpful === opt.id ? 'bg-gold border-gold text-ink' : 'bg-paper border-border-custom text-muted'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          )}

          <button 
            onClick={handleSubmit}
            disabled={outcome === null || helpful === null || (outcome === 'not_bought' && !reason) || loading}
            className="w-full py-4 bg-ink text-white rounded-2xl font-bold text-sm disabled:opacity-30 transition-all hover:opacity-95 shadow-xl shadow-ink/10"
          >
            {loading ? t('common.loading') : t('feedback.submit')}
          </button>
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6 pb-32">
      {/* 1. Header & Navigation */}
      <header className="flex items-center justify-between">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-paper rounded-full transition-colors text-ink"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 bg-gold/10 text-gold text-[8px] font-bold uppercase tracking-widest rounded-full">{plan}</span>
          {items.length > 1 ? (
            <div className="flex items-center gap-4 bg-paper px-4 py-2 rounded-full border border-border-custom">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="disabled:opacity-30 text-ink"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted">
                {currentIndex + 1} / {items.length}
              </span>
              <button 
                onClick={() => setCurrentIndex(prev => Math.min(items.length - 1, prev + 1))}
                disabled={currentIndex === items.length - 1}
                className="disabled:opacity-30 text-ink"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-end gap-1">
              <div className="px-4 py-1.5 bg-paper rounded-full flex items-center gap-2 border border-border-custom">
                <div className={`w-2 h-2 rounded-full ${
                  currentItem.item_summary.confidence === 'high' ? 'bg-decision-green' : 
                  currentItem.item_summary.confidence === 'medium' ? 'bg-decision-gold' : 
                  'bg-decision-red'
                }`} />
                <span className="text-[10px] uppercase tracking-widest font-bold text-muted">
                  {currentItem.item_summary.confidence.replace('_', ' ')} {t('analysis.confidence')}
                </span>
              </div>
              <p className="text-[8px] text-muted/60 font-medium italic pr-1">
                {currentItem.item_summary.confidence === 'high' ? t('analysis.confidence_high_desc') : 
                 currentItem.item_summary.confidence === 'medium' ? t('analysis.confidence_medium_desc') : 
                 t('analysis.confidence_low_desc')}
              </p>
              <div className="w-24 h-0.5 bg-border-custom rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out rounded-full ${
                    currentItem.item_summary.confidence === 'high' ? 'bg-decision-green' : 
                    currentItem.item_summary.confidence === 'medium' ? 'bg-decision-gold' : 
                    'bg-decision-red'
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
                className="relative flex-shrink-0 w-full aspect-[4/3] rounded-[32px] overflow-hidden bg-paper snap-center border border-border-custom"
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
      <section className="p-6 bg-white border border-border-custom rounded-[32px] shadow-sm space-y-4">
        <h1 className="serif text-3xl font-light tracking-tight leading-tight">{currentItem.item_summary.title}</h1>
        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Type</p>
            <p className="text-sm font-medium text-ink">{currentItem.item_summary.category}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Provenance</p>
            <p className="text-sm font-medium text-ink">{currentItem.item_summary.likely_origin}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Aesthetic</p>
            <p className="text-sm font-medium text-ink">{currentItem.item_summary.likely_style}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Era</p>
            <p className="text-sm font-medium text-ink">{currentItem.item_summary.likely_period}</p>
          </div>
          <div className="col-span-2">
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Confidence</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    currentItem.item_summary.confidence === 'high' ? 'bg-decision-green' : 
                    currentItem.item_summary.confidence === 'medium' ? 'bg-decision-gold' : 
                    'bg-decision-red'
                  }`} />
                  <div className="flex flex-col">
                    <p className="text-sm font-medium text-ink capitalize">
                      {currentItem.item_summary.confidence.replace('_', ' ')}
                    </p>
                    <p className="text-[9px] text-muted/60 font-medium italic">
                      {currentItem.item_summary.confidence === 'high' ? t('analysis.confidence_high_desc') : 
                       currentItem.item_summary.confidence === 'medium' ? t('analysis.confidence_medium_desc') : 
                       t('analysis.confidence_low_desc')}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-muted">{currentItem.item_summary.confidence_score}%</span>
              </div>
              
              {/* Minimal Confidence Meter */}
              <div className="h-1 w-full bg-paper rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out rounded-full ${
                    currentItem.item_summary.confidence === 'high' ? 'bg-decision-green' : 
                    currentItem.item_summary.confidence === 'medium' ? 'bg-decision-gold' : 
                    'bg-decision-red'
                  }`}
                  style={{ width: `${currentItem.item_summary.confidence_score}%` }}
                />
              </div>

              {currentItem.item_summary.confidence_reason && (
                <p className="text-[10px] text-muted leading-tight italic">
                  {currentItem.item_summary.confidence_reason}
                </p>
              )}
              {currentItem.item_summary.confidence_improvement_suggestions?.length > 0 && (
                <div className="mt-2 pt-2 border-t border-border-custom space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-muted">How to increase confidence</p>
                  <ul className="space-y-1">
                    {currentItem.item_summary.confidence_improvement_suggestions.map((suggestion: string, i: number) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-border-custom mt-1.5 shrink-0" />
                        <p className="text-[10px] text-muted font-medium leading-tight">{suggestion}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 4. Teaser Insight for Free Users */}
      {showPaywall && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-[10px] uppercase tracking-widest font-bold text-muted px-1">{t('analysis.preliminary_findings')}</h3>
            
            {currentItem.teaser_insight && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-6 py-4 bg-decision-red/5 border border-decision-red/20 rounded-2xl flex items-start gap-3"
              >
                <AlertTriangle className="w-4 h-4 text-decision-red shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-[9px] uppercase tracking-widest font-bold text-decision-red/80">Dealer's Warning</p>
                  <p className="text-sm font-medium text-ink leading-relaxed">
                    {currentItem.teaser_insight}
                  </p>
                </div>
              </motion.div>
            )}

            {/* Trust Builders: One Check & One Red Flag */}
            <div className="grid grid-cols-1 gap-3">
              {currentItem.top_checks?.[0] && (
                <div className="p-4 bg-white border border-border-custom rounded-2xl flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-decision-green shrink-0" />
                  <p className="text-xs font-medium text-ink">
                    <span className="text-muted mr-1">Inspection:</span> {currentItem.top_checks[0]}
                  </p>
                </div>
              )}
              {currentItem.red_flags?.[0] && (
                <div className="p-4 bg-white border border-border-custom rounded-2xl flex items-center gap-3">
                  <ShieldAlert className="w-4 h-4 text-decision-red shrink-0" />
                  <p className="text-xs font-medium text-ink">
                    <span className="text-muted mr-1">Flag:</span> {currentItem.red_flags[0].issue}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. Buy Score Card - Visually Dominant & First Priority */}
      <div className="space-y-6">
        {showPaywall ? (
          <PaywallCard />
        ) : (
          <section className={`p-10 ${decisionStyles.cardBg} text-white rounded-[44px] shadow-2xl shadow-ink/40 space-y-10 relative overflow-hidden transition-all duration-500 border border-white/5`}>
            <div className={`absolute top-0 right-0 w-64 h-64 ${decisionStyles.blur} blur-[100px] rounded-full -mr-32 -mt-32 transition-colors duration-500`} />
            
            {isTierD && isFree && (
              <div className="relative z-10 px-6 py-4 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 mb-6">
                <p className="text-sm font-medium text-gold leading-relaxed italic">
                  {t('paywall.low_value_notice')}
                </p>
                <p className="text-[11px] font-bold text-white/60 mt-1 uppercase tracking-wider">
                  {t('paywall.value_anchor', { 
                    low: formatPrice(currentItem.price_guidance.estimated_market_range_low), 
                    high: formatPrice(currentItem.price_guidance.estimated_market_range_high) 
                  })}
                </p>
                <div className="mt-4">
                  <ShareButton />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-[11px] text-muted uppercase tracking-[0.3em] font-bold">{t('analysis.buy_score')}</p>
                <h2 className={`serif text-5xl font-light tracking-tight ${decisionStyles.text}`}>{currentItem.buy_decision.label}</h2>
                <div className="flex items-center gap-2 pt-1">
                  <div className={`w-2 h-2 rounded-full ${decisionStyles.dot}`} />
                  <div className="flex flex-col">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-paper/60">
                      {currentItem.buy_decision.confidence.replace('_', ' ')} Confidence
                    </span>
                    <p className="text-[8px] text-paper/40 font-light italic">
                      {currentItem.buy_decision.confidence === 'high' ? t('analysis.confidence_high_desc') : 
                       currentItem.buy_decision.confidence === 'medium' ? t('analysis.confidence_medium_desc') : 
                       t('analysis.confidence_low_desc')}
                    </p>
                  </div>
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
              <p className="text-[10px] uppercase tracking-widest font-bold text-white/40 mb-2">{t('analysis.snap_judgement')}</p>
              <p className="serif text-2xl font-medium text-white italic leading-snug">
                "{currentItem.item_summary.snap_judgement}"
              </p>
            </div>

            <div className="space-y-6 relative z-10">
              <div className="space-y-4">
                {currentItem.buy_decision.decision_summary.slice(0, 3).map((point: string, i: number) => (
                  <div key={i} className="flex gap-4 items-start">
                    <div className={`w-1.5 h-1.5 rounded-full ${decisionStyles.dot} opacity-50 mt-2 shrink-0`} />
                    <p className="text-base text-white/80 leading-relaxed italic font-light">
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

      {/* 4. Price Guidance Card */}
      {showPaywall ? (
        <UpgradePlaceholder 
          title={t('analysis.price_guidance')} 
          description="See the real price vs what sellers ask"
          icon={Info} 
          requiredPlan="Pro" 
        />
      ) : (
        <section className="p-6 bg-white border border-border-custom rounded-[32px] shadow-sm space-y-6">
          <div className="flex items-center gap-2 text-muted">
            <Info className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.price_guidance')}</h3>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted">Value Insight</p>
              <p className="text-xl font-medium text-ink">
                {formatPrice(currentItem.price_guidance.estimated_market_range_low)} - {formatPrice(currentItem.price_guidance.estimated_market_range_high)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-decision-green/70">Smart Buy</p>
              <p className="text-xl font-medium text-decision-green">
                {formatPrice(currentItem.price_guidance.good_buy_below)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted">Retail Range</p>
              <p className="text-lg font-medium text-muted">
                {formatPrice(currentItem.price_guidance.fair_price_low)} - {formatPrice(currentItem.price_guidance.fair_price_high)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-[9px] uppercase tracking-widest font-bold text-decision-red/80">Overpaying</p>
              <p className="text-lg font-medium text-decision-red">
                {formatPrice(currentItem.price_guidance.overpaying_above)}
              </p>
            </div>
          </div>

          <p className="text-xs text-muted leading-relaxed border-t border-border-custom pt-4 italic">
            {currentItem.price_guidance.pricing_reasoning}
          </p>
        </section>
      )}

      {/* 5. Dealer Take Card */}
      {showDealerContent ? (
        <section className="p-6 bg-paper rounded-[32px] border border-border-custom space-y-4">
          <div className="flex items-center gap-2 text-gold">
            <Gavel className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.dealer_perspective')}</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-1">Dealer's Buy</p>
              <p className="text-lg font-medium text-ink">
                {formatPrice(currentItem.dealer_take.target_buy_price_low)} - {formatPrice(currentItem.dealer_take.target_buy_price_high)}
              </p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-1">Exit Strategy</p>
              <p className="text-sm text-muted leading-relaxed">{currentItem.dealer_take.resale_strategy}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted">Trade Assessment</p>
              {currentItem.dealer_take.dealer_view.map((view: string, i: number) => (
                <p key={i} className="text-sm text-muted leading-relaxed flex gap-2">
                  <span className="text-gold">•</span> {view}
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
        <section className="p-8 bg-white border border-border-custom rounded-[44px] shadow-sm space-y-8">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-decision-green/70">
              <Handshake className="w-4 h-4" />
              <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.negotiation_strategy')}</h3>
            </div>
            <h2 className="serif text-3xl font-light tracking-tight text-ink">Buying Strategy</h2>
            <p className="text-muted text-sm font-light italic">What experienced dealers would do</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-6 bg-decision-green/5 rounded-3xl border border-decision-green/10 text-center">
              <p className="text-[9px] uppercase tracking-widest font-bold text-decision-green/70 mb-2">First Bid</p>
              <p className="text-xl sm:text-2xl font-bold text-decision-green tracking-tight">{formatPrice(currentItem.negotiation_strategy.opening_offer)}</p>
            </div>
            <div className="p-6 bg-paper rounded-3xl border border-border-custom text-center">
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-2">Closing Target</p>
              <p className="text-xl sm:text-2xl font-bold text-ink tracking-tight">
                {formatPrice(currentItem.negotiation_strategy.target_price_low)} – {formatPrice(currentItem.negotiation_strategy.target_price_high)}
              </p>
            </div>
          </div>
          <div className="space-y-4 pt-4 border-t border-border-custom">
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted">Leverage Points</p>
            <div className="space-y-3">
              {currentItem.negotiation_strategy.points_to_raise.map((point: string, i: number) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-5 h-5 rounded-full bg-decision-green/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-decision-green text-[10px] font-bold">→</span>
                  </div>
                  <p className="text-sm text-ink leading-relaxed font-light">
                    {point}
                  </p>
                </div>
              ))}
            </div>
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
        <section className="p-6 bg-decision-red/5 border border-decision-red/20 rounded-[32px] space-y-4">
          <div className="flex items-center gap-2 text-decision-red">
            <OctagonX className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold opacity-80">{t('analysis.when_to_walk_away')}</h3>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-decision-red">Walk-away price: {formatPrice(currentItem.negotiation_strategy.walk_away_price)}</p>
            <div className="space-y-2">
              {currentItem.walk_away_if.slice(0, 3).map((condition: string, i: number) => (
                <p key={i} className="text-sm text-decision-red/80 leading-relaxed flex gap-2">
                  <span className="text-decision-red font-bold">!</span> {condition}
                </p>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 8. Top 3 Checks Card */}
      {!showPaywall && (
        <section className="p-6 bg-white border border-border-custom rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-muted">
            <CheckCircle className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.checklist')}</h3>
          </div>
          <div className="space-y-3">
            {currentItem.top_checks.slice(0, 3).map((check: string, i: number) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-paper rounded-2xl">
                <div className="w-6 h-6 rounded-full bg-white border border-border-custom flex items-center justify-center text-[10px] font-bold text-muted">
                  {i + 1}
                </div>
                <p className="text-sm font-medium text-muted">{check}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 9. Red Flags Card */}
      {!showPaywall && currentItem.red_flags.length > 0 && (
        <section className="p-6 bg-white border border-border-custom rounded-[32px] shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-decision-red">
            <ShieldAlert className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.red_flags')}</h3>
          </div>
          <div className="space-y-3">
            {currentItem.red_flags.map((flag: any, i: number) => (
              <div key={i} className={`p-4 rounded-2xl space-y-2 border ${
                flag.severity === 'high' ? 'bg-decision-red/5 border-decision-red/20' :
                flag.severity === 'medium' ? 'bg-decision-gold/5 border-decision-gold/20' :
                'bg-paper border-border-custom'
              }`}>
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest ${
                    flag.severity === 'high' ? 'bg-decision-red/10 text-decision-red' :
                    flag.severity === 'medium' ? 'bg-decision-gold/10 text-decision-gold' :
                    'bg-border-custom text-muted'
                  }`}>
                    {flag.severity}
                  </span>
                </div>
                <p className="text-sm font-bold text-ink">{flag.issue}</p>
                <p className="text-xs text-muted leading-relaxed">{flag.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 10. Market Insight Card */}
      {showProContent ? (
        <section className="p-6 bg-paper rounded-[32px] border border-border-custom space-y-4">
          <div className="flex items-center gap-2 text-muted">
            <Info className="w-4 h-4" />
            <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('analysis.market_insight')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Appetite</p>
              <p className="text-sm font-medium text-ink capitalize">{currentItem.market_insight.demand}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-0.5">Liquidity</p>
              <p className="text-sm font-medium text-ink capitalize">{currentItem.market_insight.resale_ease.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-[9px] uppercase tracking-widest font-bold text-muted">What Sells This</p>
            <div className="flex flex-wrap gap-2">
              {currentItem.market_insight.drivers_of_value.map((driver: string, i: number) => (
                <span key={i} className="px-3 py-1 bg-white border border-border-custom rounded-full text-[10px] text-muted">
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

      {/* 11. Feedback System */}
      {!showPaywall && (
        <FeedbackSection currentItem={currentItem} />
      )}

      {/* 12. Disclaimer */}
      <p className="text-[10px] text-muted leading-relaxed text-center px-8 pt-4">
        {currentItem.disclaimer}
      </p>

      {/* 12. Sticky Bottom Action Bar */}
      {!isSaved && onSave && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-border-custom flex gap-4 z-50">
          <button
            onClick={onBack}
            className="flex-1 py-4 bg-paper text-ink rounded-full font-medium hover:bg-border-custom transition-colors"
          >
            {t('common.back')}
          </button>
          <button
            onClick={() => onSave('watching')}
            className="flex-1 py-4 bg-ink text-paper rounded-full font-medium hover:opacity-90 transition-colors flex items-center justify-center gap-2 shadow-xl shadow-ink/20"
          >
            <Save className="w-5 h-5" />
            {t('common.save')}
          </button>
        </div>
      )}
    </div>
  );
};
