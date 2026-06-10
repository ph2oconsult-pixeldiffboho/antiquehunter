import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Search, MapPin, Globe, Sparkles, ExternalLink, Loader2, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, Check } from 'lucide-react';

interface AntiqueHunterProps {
  onBack: () => void;
  currency: string;
}

interface SourcingMatch {
  title: string;
  url: string;
  platform: string;
  price: string;
  location: string;
  date?: string;
  description?: string;
  dealerAnalysis: string;
}

interface SourcingResults {
  marketBrief: string;
  matches: SourcingMatch[];
  dealerClosingTip: string;
}

export const AntiqueHunter: React.FC<AntiqueHunterProps> = ({ onBack, currency }) => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [targetBudget, setTargetBudget] = useState('');
  const [isSourcing, setIsSourcing] = useState(false);
  const [results, setResults] = useState<SourcingResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Geographic region preferences
  const [geographies, setGeographies] = useState<string[]>(['France', 'United Kingdom']);
  const availableGeographies = ['France', 'United Kingdom', 'United States', 'Europe', 'Global/Rest of World'];

  // Platform preferences
  const [platforms, setPlatforms] = useState<string[]>(['Interencheres', 'Drouot', 'LeBonCoin', 'Christie\'s']);
  const availablePlatforms = ['Interencheres', 'Drouot', 'LeBonCoin', 'Christie\'s', 'Sotheby\'s', 'eBay'];

  // Sourcing loading message cycle
  const [sourcingStep, setSourcingStep] = useState(0);
  const sourcingMessages = [
    'Connecting to European auction archives...',
    'Querying Interencheres catalog indexes...',
    'Analyzing current active lots on Drouot...',
    'Scouring LeBonCoin classified market listings...',
    'Auditing Sotheby\'s and Christie\'s database archives...',
    'Compiling matching pieces and checking asking rates...',
    'Adding professional dealer valuation and sourcing notes...'
  ];

  const handleGeographyToggle = (geo: string) => {
    setGeographies(prev =>
      prev.includes(geo) ? prev.filter(g => g !== geo) : [...prev, geo]
    );
  };

  const handlePlatformToggle = (plat: string) => {
    setPlatforms(prev =>
      prev.includes(plat) ? prev.filter(p => p !== plat) : [...prev, plat]
    );
  };

  const executeSourcing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSourcing(true);
    setResults(null);
    setError(null);
    setSourcingStep(0);

    // Dynamic rotation of loading steps
    const stepInterval = setInterval(() => {
      setSourcingStep(prev => (prev + 1) % sourcingMessages.length);
    }, 2200);

    try {
      const response = await fetch('/api/hunt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          geographies,
          platforms,
          priceRange: targetBudget ? `${targetBudget} ${currency}` : undefined,
          currency,
          language: i18n.language
        })
      });

      const textResponse = await response.text();
      let data: any;
      try {
        data = JSON.parse(textResponse);
      } catch {
        throw new Error('Server returned an unexpected response. Please ensure server is running.');
      }

      clearInterval(stepInterval);

      if (data.success && data.results) {
        setResults(data.results);
      } else {
        throw new Error(data.error || 'Sourcing check failed to find any matches.');
      }
    } catch (err: any) {
      clearInterval(stepInterval);
      console.error('Sourcing run failure:', err);
      setError(err?.message || 'The sourcing scan encountered a localized timeout. Please try refining your parameters.');
    } finally {
      setIsSourcing(false);
    }
  };

  const getPlatformColors = (platformName: string) => {
    const name = platformName.toLowerCase();
    if (name.includes('interencheres')) return { bg: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Interencheres Direct' };
    if (name.includes('drouot')) return { bg: 'bg-amber-50 border-amber-200 text-amber-800', label: 'Drouot Auction' };
    if (name.includes('leboncoin')) return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', label: 'LeBonCoin Market' };
    if (name.includes('christie')) return { bg: 'bg-red-50 border-red-200 text-red-800', label: "Christie's Premium" };
    if (name.includes('sotheby')) return { bg: 'bg-purple-50 border-purple-200 text-purple-800', label: "Sotheby's Premium" };
    if (name.includes('ebay')) return { bg: 'bg-slate-50 border-slate-200 text-slate-800', label: 'eBay Secondary' };
    return { bg: 'bg-stone-50 border-stone-200 text-stone-700', label: platformName };
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-10 pb-32">
      {/* Header */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-xs uppercase tracking-widest font-bold text-muted hover:text-ink transition-colors"
          >
            ← {t('common.back', 'Back')}
          </button>
          <div className="inline-flex items-center gap-1 px-3 py-1 bg-gold/10 text-gold rounded-full border border-gold/20">
            <Globe className="w-3 h-3 animate-spin" />
            <span className="text-[9px] uppercase tracking-widest font-bold">Live Global Sourcing</span>
          </div>
        </div>
        <h1 className="serif text-4xl font-light tracking-tight leading-tight text-ink">Find Me an Antique</h1>
        <p className="text-muted leading-relaxed">
          Instruct our global dealer sourcing engine. We will comb through renowned databases including **Interencheres**, **Drouot**, **LeBonCoin**, and elite international houses in real-time.
        </p>
      </section>

      {/* Sourcing Input Card */}
      {!isSourcing && !results && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-border-custom rounded-[32px] p-8 shadow-sm space-y-6"
        >
          <form onSubmit={executeSourcing} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-ink">Specific Piece or Item Description</label>
              <div className="relative">
                <Search className="absolute left-4 top-4 w-5 h-5 text-muted" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Louis XV Cherrywood Commode, Sevrès enamel vase..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 bg-paper border border-border-custom rounded-2xl text-ink focus:outline-none focus:border-gold transition-colors text-sm"
                />
              </div>
              <p className="text-[10px] text-muted">Include style, wood type, or creator if known to make searches precise.</p>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-ink">Target Budget & Price Range (Optional)</label>
              <input
                type="text"
                placeholder={`e.g. Under €1,500, or £500 - £2,000`}
                value={targetBudget}
                onChange={(e) => setTargetBudget(e.target.value)}
                className="w-full px-4 py-4 bg-paper border border-border-custom rounded-2xl text-ink focus:outline-none focus:border-gold transition-colors text-sm"
              />
            </div>

            {/* Geography Settings */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-ink flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-gold" /> Selected Sourcing Geographies
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {availableGeographies.map((geo) => {
                  const selected = geographies.includes(geo);
                  return (
                    <button
                      key={geo}
                      type="button"
                      onClick={() => handleGeographyToggle(geo)}
                      className={`px-4 py-2 text-xs rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                        selected 
                          ? 'bg-decision-green text-white border-decision-green shadow-md scale-[1.03] font-semibold' 
                          : 'bg-paper text-muted border-border-custom hover:bg-white hover:text-ink'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                      <span>{geo}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Platform Priorities */}
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wider font-bold text-ink flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-gold" /> Target Reputable Channels
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {availablePlatforms.map((plat) => {
                  const selected = platforms.includes(plat);
                  return (
                    <button
                      key={plat}
                      type="button"
                      onClick={() => handlePlatformToggle(plat)}
                      className={`px-4 py-2 text-xs rounded-full border transition-all flex items-center gap-1.5 cursor-pointer ${
                        selected 
                          ? 'bg-decision-green text-white border-decision-green shadow-md scale-[1.03] font-semibold' 
                          : 'bg-paper text-muted border-border-custom hover:bg-white hover:text-ink'
                      }`}
                    >
                      {selected && <Check className="w-3 h-3 text-white" />}
                      <span>{plat}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-ink text-paper rounded-full font-medium hover:opacity-95 transition-all shadow-xl shadow-ink/20 flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-gold animate-pulse" />
              <span>Begin Sourcing Scan</span>
            </button>
          </form>
        </motion.div>
      )}

      {/* Sourcing State Loading */}
      <AnimatePresence>
        {isSourcing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white border border-border-custom rounded-[32px] p-8 text-center space-y-8 shadow-md"
          >
            <div className="relative py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
                className="w-24 h-24 border-t-2 border-r-2 border-gold rounded-full mx-auto"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-8 h-8 text-gold animate-pulse" />
              </div>
            </div>
            <div className="space-y-4 max-w-sm mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={sourcingStep}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.4 }}
                  className="serif text-xl font-light text-ink leading-tight"
                >
                  {sourcingMessages[sourcingStep]}
                </motion.div>
              </AnimatePresence>
              <p className="text-xs text-muted">
                Our bot compiles public listings while filtering out modern reproduction fluff. Real pieces only.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-3xl p-6 flex flex-col gap-4 text-center">
          <div className="flex items-center justify-center gap-2 text-red-800 font-bold text-sm">
            <AlertCircle className="w-5 h-5" /> Sourcing Interrupted
          </div>
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          <button
            onClick={() => { setError(null); setResults(null); }}
            className="px-6 py-3 bg-red-850 hover:bg-red-800 text-white rounded-full text-xs font-semibold self-center"
          >
            Try Sourcing Again
          </button>
        </div>
      )}

      {/* Sourcing Results View */}
      {results && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Market Brief Card */}
          <div className="bg-white border border-border-custom rounded-[32px] p-8 shadow-sm space-y-4">
            <div className="space-y-1">
              <span className="text-[9px] uppercase tracking-widest font-bold text-gold">Dealer Market Brief</span>
              <h2 className="serif text-2xl font-light text-ink">Active Market Climate</h2>
            </div>
            <p className="text-sm text-ink leading-relaxed font-light">{results.marketBrief}</p>
          </div>

          {/* Sourcing Listings List */}
          <div className="space-y-6">
            <h3 className="serif text-xl font-light text-ink pl-2 flex items-center justify-between">
              <span>Sourced Lots & Classified Matches ({results.matches?.length || 0})</span>
              <button 
                onClick={() => { setResults(null); }}
                className="text-xs uppercase tracking-widest text-muted hover:text-ink font-bold font-sans flex items-center gap-1.5"
              >
                <RefreshCw className="w-3 h-3" /> New Search
              </button>
            </h3>

            {results.matches && results.matches.length > 0 ? (
              <div className="space-y-6">
                {results.matches.map((item, index) => {
                  const categoryBadge = getPlatformColors(item.platform);
                  return (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="bg-white border border-border-custom rounded-[28px] p-6 shadow-sm flex flex-col gap-4 hover:shadow-md transition-all group"
                    >
                      {/* Top Header Card */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${categoryBadge.bg}`}>
                              {categoryBadge.label}
                            </span>
                            {item.location && (
                              <span className="text-muted text-[10px] flex items-center gap-1 text-stone-500 font-sans">
                                <MapPin className="w-3 h-3 text-stone-400" /> {item.location}
                              </span>
                            )}
                          </div>
                          <h4 className="serif text-lg font-light text-ink mt-1.5 leading-snug group-hover:text-gold transition-colors">
                            {item.title}
                          </h4>
                        </div>
                        
                        {/* Price Display */}
                        <div className="text-right whitespace-nowrap">
                          <p className="font-mono text-xs font-semibold text-ink bg-paper px-3 py-1.5 border border-border-custom rounded-xl shadow-inner inline-block">
                            {item.price || 'Market Rate'}
                          </p>
                          {item.date && (
                            <p className="text-[9px] text-muted font-sans font-bold uppercase tracking-wider mt-1 text-amber-600">
                              {item.date}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Item Details */}
                      {item.description && (
                        <p className="text-xs text-muted leading-relaxed italic bg-paper/55 p-3 rounded-xl border border-dashed border-border-custom">
                          &ldquo;{item.description}&rdquo;
                        </p>
                      )}

                      {/* Professional Sourcing Take */}
                      <div className="bg-stone-50 border-l-2 border-gold p-4 rounded-r-2xl space-y-1.5">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-gold flex items-center gap-1">
                          <ShieldCheck className="w-3 h-3" /> Dealer Field Audit Sourcing Note
                        </span>
                        <p className="text-xs text-ink leading-relaxed font-light">{item.dealerAnalysis}</p>
                      </div>

                      {/* Sourcing Action Link */}
                      <a
                        href={item.url}
                        target="_blank"
                        referrerPolicy="no-referrer"
                        className="w-full mt-2 py-3 bg-paper border border-border-custom hover:bg-border-custom transition-all text-ink text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 group-hover:border-gold/30"
                      >
                        <span>Visit Sourcing Listing</span>
                        <ExternalLink className="w-3.5 h-3.5 text-muted" />
                      </a>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-paper border border-border-custom rounded-3xl p-8 text-center text-muted text-xs">
                No active listings matched the sourcing filter exactly. Try expanding search keywords.
              </div>
            )}
          </div>

          {/* Sourcing Closing Recommendation Tip */}
          {results.dealerClosingTip && (
            <div className="bg-amber-50/50 border border-amber-200/60 rounded-[32px] p-8 space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gold/10 flex items-center justify-center text-gold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="serif text-lg font-light text-ink">Dealer Insider Sourcing Advice</h3>
              </div>
              <p className="text-xs text-ink leading-relaxed font-light">{results.dealerClosingTip}</p>
            </div>
          )}

          <div className="text-center pt-4">
            <button
              onClick={() => { setResults(null); }}
              className="px-8 py-4 bg-ink text-paper hover:opacity-95 rounded-full text-xs font-bold shadow-xl shadow-ink/10 transition-all inline-flex items-center gap-2"
            >
              <span>Initiate New Sourcing Loop</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};
