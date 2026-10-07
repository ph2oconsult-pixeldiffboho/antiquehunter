import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { Search, MapPin, Globe, Sparkles, ExternalLink, Loader2, ArrowRight, ShieldCheck, AlertCircle, RefreshCw, Check, ChevronDown, ChevronUp, Copy, BookOpen } from 'lucide-react';

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
  imageUrl?: string;
  verification?: 'verified' | 'unverified';
  verificationNote?: string;
}

interface SourcingResults {
  marketBrief: string;
  matches: SourcingMatch[];
  dealerClosingTip: string;
  message?: string;
  stats?: { returned: number; verified: number; unverified: number; dropped: number };
}

interface HuntRequest {
  query: string;
  geographies: string[];
  platforms: string[];
  priceRange?: string;
  currency: string;
  language: string;
  periodOnly: boolean;
}

const HUNT_CURRENCIES = ['EUR', 'GBP', 'USD', 'SEK'];
const SWEDISH_PLATFORMS = ['Auctionet', 'Bukowskis'];
const CLIENT_TIMEOUT_MS = 70_000;

export const AntiqueHunter: React.FC<AntiqueHunterProps> = ({ onBack, currency }) => {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');
  const [targetBudget, setTargetBudget] = useState('');
  const [isSourcing, setIsSourcing] = useState(false);
  const [results, setResults] = useState<SourcingResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequest, setLastRequest] = useState<HuntRequest | null>(null);
  const [huntCurrency, setHuntCurrency] = useState<string>(() => {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('hunt_currency') : null;
    if (saved && HUNT_CURRENCIES.includes(saved)) return saved;
    return HUNT_CURRENCIES.includes(currency) ? currency : 'EUR';
  });
  const [periodOnly, setPeriodOnly] = useState(true);
  const [expandedVerifyId, setExpandedVerifyId] = useState<number | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedDraftIndex, setCopiedDraftIndex] = useState<number | null>(null);

  // Geographic region preferences
  const [geographies, setGeographies] = useState<string[]>(['France', 'United Kingdom']);
  const availableGeographies = ['France', 'United Kingdom', 'Sweden', 'United States', 'Europe', 'Global/Rest of World'];

  // Platform preferences
  const [platforms, setPlatforms] = useState<string[]>(['Interencheres', 'Drouot', 'LeBonCoin', 'Christie\'s']);
  const availablePlatforms = ['Interencheres', 'Drouot', 'LeBonCoin', 'Christie\'s', 'Sotheby\'s', 'eBay', ...SWEDISH_PLATFORMS];

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
    const turningOn = !geographies.includes(geo);
    setGeographies(prev =>
      prev.includes(geo) ? prev.filter(g => g !== geo) : [...prev, geo]
    );
    // Swedish auction sources are added automatically when Sweden or Europe is selected
    if (turningOn && (geo === 'Sweden' || geo === 'Europe')) {
      setPlatforms(prev => Array.from(new Set([...prev, ...SWEDISH_PLATFORMS])));
    }
  };

  const handleCurrencyChange = (value: string) => {
    setHuntCurrency(value);
    try { localStorage.setItem('hunt_currency', value); } catch { /* ignore */ }
  };

  const handlePlatformToggle = (plat: string) => {
    setPlatforms(prev =>
      prev.includes(plat) ? prev.filter(p => p !== plat) : [...prev, plat]
    );
  };

  const runSearch = async (request: HuntRequest) => {
    setIsSourcing(true);
    setResults(null);
    setError(null);
    setSourcingStep(0);
    setLastRequest(request);

    // Dynamic rotation of loading steps
    const stepInterval = setInterval(() => {
      setSourcingStep(prev => (prev + 1) % sourcingMessages.length);
    }, 2200);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      let response: Response;
      try {
        response = await fetch('/api/hunt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
          signal: controller.signal
        });
      } catch (networkErr: any) {
        throw new Error(networkErr?.name === 'AbortError'
          ? t('hunter.error_timeout')
          : t('hunter.error_network'));
      }

      const textResponse = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(textResponse);
      } catch {
        data = null;
      }

      if (!data) {
        // Vercel timeouts (504) and other gateway errors return HTML/plain text, never fake data
        throw new Error(response.status === 504 || response.status === 408
          ? t('hunter.error_timeout')
          : t('hunter.error_generic'));
      }
      if (!data.success || !data.results) {
        throw new Error(data.code === 'timeout' ? t('hunter.error_timeout') : t('hunter.error_generic'));
      }
      setResults(data.results as SourcingResults);
    } catch (err: any) {
      console.error('Sourcing run failure:', err);
      setError(err?.message || t('hunter.error_generic'));
    } finally {
      clearTimeout(timeoutId);
      clearInterval(stepInterval);
      setIsSourcing(false);
    }
  };

  const executeSourcing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    await runSearch({
      query,
      geographies,
      platforms,
      priceRange: targetBudget.trim() ? `${targetBudget.trim()} ${huntCurrency}` : undefined,
      currency: huntCurrency,
      language: i18n.language,
      periodOnly
    });
  };

  const getPlatformColors = (platformName: string) => {
    const name = platformName.toLowerCase();
    if (name.includes('interencheres')) return { bg: 'bg-blue-50 border-blue-200 text-blue-700', label: 'Interencheres Direct' };
    if (name.includes('drouot')) return { bg: 'bg-amber-50 border-amber-200 text-amber-800', label: 'Drouot Auction' };
    if (name.includes('leboncoin')) return { bg: 'bg-emerald-50 border-emerald-200 text-emerald-800', label: 'LeBonCoin Market' };
    if (name.includes('christie')) return { bg: 'bg-red-50 border-red-200 text-red-800', label: "Christie's Premium" };
    if (name.includes('sotheby')) return { bg: 'bg-purple-50 border-purple-200 text-purple-800', label: "Sotheby's Premium" };
    if (name.includes('ebay')) return { bg: 'bg-slate-50 border-slate-200 text-slate-800', label: 'eBay Secondary' };
    if (name.includes('auctionet')) return { bg: 'bg-sky-50 border-sky-200 text-sky-800', label: 'Auctionet' };
    if (name.includes('bukowski')) return { bg: 'bg-indigo-50 border-indigo-200 text-indigo-800', label: 'Bukowskis' };
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
        <div className="text-muted leading-relaxed [&_strong]:text-ink [&_strong]:font-semibold">
          <ReactMarkdown>{t('hunter.intro')}</ReactMarkdown>
        </div>
      </section>

      {/* Sourcing Input Card */}
      {!isSourcing && !results && !error && (
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
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder={t('hunter.budget_placeholder')}
                  value={targetBudget}
                  onChange={(e) => setTargetBudget(e.target.value)}
                  className="flex-1 min-w-0 px-4 py-4 bg-paper border border-border-custom rounded-2xl text-ink focus:outline-none focus:border-gold transition-colors text-sm"
                />
                <select
                  value={huntCurrency}
                  onChange={(e) => handleCurrencyChange(e.target.value)}
                  aria-label={t('hunter.currency')}
                  className="w-24 px-3 py-4 bg-paper border border-border-custom rounded-2xl text-ink text-sm font-bold focus:outline-none focus:border-gold cursor-pointer"
                >
                  {HUNT_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Period pieces only */}
            <label className="flex items-start justify-between gap-4 p-4 bg-paper border border-border-custom rounded-2xl cursor-pointer">
              <span className="space-y-1">
                <span className="block text-xs uppercase tracking-wider font-bold text-ink">{t('hunter.period_only')}</span>
                <span className="block text-[11px] text-muted leading-snug">{t('hunter.period_only_desc')}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={periodOnly}
                aria-label={t('hunter.period_only')}
                onClick={() => setPeriodOnly(v => !v)}
                className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${periodOnly ? 'bg-decision-green' : 'bg-border-custom'}`}
              >
                <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow transition-transform ${periodOnly ? 'translate-x-5' : ''}`} />
              </button>
            </label>

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
            <AlertCircle className="w-5 h-5" /> {t('hunter.error_title')}
          </div>
          <p className="text-xs text-red-700 leading-relaxed">{error}</p>
          <div className="flex flex-col sm:flex-row gap-2 self-center">
            {lastRequest && (
              <button
                onClick={() => runSearch(lastRequest)}
                className="px-6 py-3 bg-red-700 hover:bg-red-800 text-white rounded-full text-xs font-semibold inline-flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" /> {t('hunter.retry')}
              </button>
            )}
            <button
              onClick={() => { setError(null); setResults(null); }}
              className="px-6 py-3 bg-white border border-red-200 hover:bg-red-100 text-red-800 rounded-full text-xs font-semibold"
            >
              {t('hunter.edit_search')}
            </button>
          </div>
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

            {results.stats && (
              <p className="text-[10px] text-muted pl-2 -mt-3">
                {t('hunter.checked_summary', { verified: results.stats.verified, unverified: results.stats.unverified, dropped: results.stats.dropped })}
              </p>
            )}

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
                      className="bg-white border border-border-custom rounded-[28px] p-6 shadow-sm flex flex-col md:flex-row gap-6 hover:shadow-md transition-all group"
                    >
                      {item.imageUrl && (
                        <div className="w-full md:w-44 h-48 md:h-auto min-h-[160px] relative shrink-0 rounded-2xl overflow-hidden border border-border-custom/60 bg-paper">
                          <img
                            src={item.imageUrl}
                            alt={item.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/25 to-transparent pointer-events-none" />
                        </div>
                      )}

                      <div className="flex-1 flex flex-col justify-between gap-4">
                        {/* Top Header Card */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-0.5 border rounded-full text-[9px] font-bold tracking-wider uppercase ${categoryBadge.bg}`}>
                                {categoryBadge.label}
                              </span>
                              {item.verification === 'verified' && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                  <Check className="w-3 h-3" /> {t('hunter.verified')}
                                </span>
                              )}
                              {item.verification === 'unverified' && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200" title={t('hunter.unverified_desc')}>
                                  {t('hunter.unverified')}
                                </span>
                              )}
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

                        {item.verification === 'unverified' && (
                          <p className="text-[10px] text-amber-700 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 shrink-0" /> {t('hunter.unverified_desc')}
                          </p>
                        )}

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

                        {/* Action Row */}
                        <div className="flex flex-col sm:flex-row gap-3 mt-2">
                          {/* Direct Listing Link */}
                          <a
                            href={item.url}
                            target="_blank"
                            referrerPolicy="no-referrer"
                            className="flex-1 py-3 px-4 bg-ink text-paper hover:opacity-95 transition-all text-xs font-semibold rounded-2xl flex items-center justify-center gap-2"
                          >
                            <span>Source Listing Link</span>
                            <ExternalLink className="w-3.5 h-3.5 text-paper/85" />
                          </a>

                          {/* Authenticity Trigger */}
                          <button
                            type="button"
                            onClick={() => setExpandedVerifyId(expandedVerifyId === index ? null : index)}
                            className={`flex-1 py-3 px-4 border text-xs font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all ${
                              expandedVerifyId === index
                                ? "bg-amber-50 border-amber-300 text-amber-950 font-bold"
                                : "bg-paper border-border-custom hover:bg-border-custom/50 text-ink"
                            }`}
                          >
                            <ShieldCheck className={`w-3.5 h-3.5 ${expandedVerifyId === index ? "text-amber-700 animate-pulse" : "text-gold"}`} />
                            <span>Authenticate & Verify Sourcing</span>
                            {expandedVerifyId === index ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
                          </button>
                        </div>

                        {/* Expandable Verification Panel */}
                        <AnimatePresence>
                          {expandedVerifyId === index && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              transition={{ duration: 0.25 }}
                              className="overflow-hidden bg-[#faf9f6] border border-border-custom/80 rounded-2xl p-5 space-y-4 mt-1 text-ink"
                            >
                              <div className="border-b border-border-custom/65 pb-3">
                                <h5 className="font-semibold text-xs flex items-center gap-1.5 text-stone-900 uppercase tracking-wider">
                                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  What if the listing link is locked or geo-restricted?
                                </h5>
                                <p className="text-[11px] text-stone-600 mt-1 font-light">
                                  Private auction archives, regional platforms (like LeBonCoin), and dealer catalogs often hide items behind paywalls, login screens, or local IP blockages. Use the alternate verification toolkit below to cross-reference and claim this item.
                                </p>
                              </div>

                              {/* Tool 1: Google Alternate Search Strings */}
                              <div className="space-y-2">
                                <span className="text-[9px] uppercase tracking-widest font-bold text-stone-500 font-sans">
                                  Bypass Tool 1: Copy Search Query & Search Indirectly
                                </span>
                                <div className="flex flex-col sm:flex-row gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const queryText = `${item.title} ${item.location || ""}`.trim();
                                      navigator.clipboard.writeText(queryText);
                                      setCopiedIndex(index);
                                      setTimeout(() => setCopiedIndex(null), 2000);
                                    }}
                                    className="flex-1 py-2 px-3 bg-white border border-border-custom hover:bg-stone-50 rounded-xl text-[11px] font-medium flex items-center justify-between gap-1.5 transition-colors"
                                  >
                                    <span className="truncate max-w-[200px] text-stone-700">"{item.title}"</span>
                                    {copiedIndex === index ? (
                                      <span className="text-emerald-600 font-bold flex items-center gap-1 text-[10px]">
                                        <Check className="w-3.5 h-3.5" /> Copied Query
                                      </span>
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                                    )}
                                  </button>

                                  <a
                                    href={`https://www.google.com/search?q=${encodeURIComponent(`site:${item.platform.toLowerCase()}.com "${item.title}"`)}&tbm=isch`}
                                    target="_blank"
                                    referrerPolicy="no-referrer"
                                    className="sm:w-auto px-4 py-2 bg-white border border-border-custom hover:border-gold/30 rounded-xl text-[11px] font-semibold text-gold flex items-center justify-center gap-1.5 transition-colors"
                                  >
                                    <Search className="w-3.5 h-3.5" />
                                    <span>Google Images Backup</span>
                                  </a>
                                </div>
                              </div>

                              {/* Tool 2: Era Physical Integrity Check */}
                              <div className="space-y-2 pt-1">
                                <span className="text-[9px] uppercase tracking-widest font-bold text-stone-500 font-sans">
                                  Bypass Tool 2: Physical Era Authenticity Markers
                                </span>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] text-stone-700 font-sans">
                                  <div className="bg-white p-2.5 rounded-xl border border-border-custom/50 flex gap-2">
                                    <span className="text-amber-500 font-semibold shrink-0">1.</span>
                                    <div>
                                      <p className="font-bold">Check Back/Underneath Wood</p>
                                      <p className="text-[10px] text-muted leading-tight mt-0.5">Authentic pre-1850 back panels demonstrate irregular parallel hand-sawn markings or clean adze finish ripples, never circle circular-saw lines.</p>
                                    </div>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-xl border border-border-custom/50 flex gap-2">
                                    <span className="text-amber-500 font-semibold shrink-0">2.</span>
                                    <div>
                                      <p className="font-bold">Hardware & Screws Inspection</p>
                                      <p className="text-[10px] text-muted leading-tight mt-0.5">Antique iron screws have hand-filed, off-center slot heads. Check if screws show modern threaded uniformity, which indicates restoration or reproduction.</p>
                                    </div>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-xl border border-border-custom/50 flex gap-2">
                                    <span className="text-amber-500 font-semibold shrink-0">3.</span>
                                    <div>
                                      <p className="font-bold">Dowel & Mortise Joins</p>
                                      <p className="text-[10px] text-muted leading-tight mt-0.5">Veneer cabinets or chairs should be bound by solid polygonal wooden peg dowels, lightly protruding and displaying dry shrinking edges.</p>
                                    </div>
                                  </div>
                                  <div className="bg-white p-2.5 rounded-xl border border-border-custom/50 flex gap-2">
                                    <span className="text-amber-500 font-semibold shrink-0">4.</span>
                                    <div>
                                      <p className="font-bold">Smell & Wax Patina</p>
                                      <p className="text-[10px] text-muted leading-tight mt-0.5">Matured walnut or cherrywood radiates a specific mild, deep honeyed and beeswax attic scent; artificial chemical colorings emit synthetic solvents.</p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Tool 3: Copy Pre-written Messenger Template */}
                              <div className="space-y-2 pt-1 border-t border-border-custom/40">
                                <span className="text-[9px] uppercase tracking-widest font-bold text-stone-500 font-sans">
                                  Bypass Tool 3: Messenger Draft for Platform or Dealer
                                </span>
                                <div className="space-y-1.5">
                                  <p className="text-[10px] text-stone-500 leading-normal">
                                    Contact the auction master or private classified seller directly on their platform's messenger using clear, professional collector questions to request extra photos of the hallmarks.
                                  </p>
                                  <div className="relative">
                                    <textarea
                                      readOnly
                                      className="w-full h-24 p-3 bg-white border border-border-custom rounded-xl text-[11px] leading-relaxed resize-none text-stone-800 focus:outline-none"
                                      value={
                                        item.platform.toLowerCase() === "interencheres" || item.platform.toLowerCase() === "drouot" || item.platform.toLowerCase() === "leboncoin"
                                          ? `Bonjour, je vous contacte au sujet de votre lot "${item.title}". Serait-il possible d'obtenir de plus amples informations d'authenticité, notamment des photographies détaillées des assemblages de menuiserie, du dos du meuble et d'éventuelles signatures ou estampilles ? Merci beaucoup de votre professionnalisme.`
                                          : `Hello, I'm reaching out regarding your listing for "${item.title}". Could you please provide high-resolution close-up photographs showing the joinery/mortises, the back/underside paneling, and any maker marks or hallmarks to help me verify the era authenticity? Thank you in advance for your assistance.`
                                      }
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const draftText = item.platform.toLowerCase() === "interencheres" || item.platform.toLowerCase() === "drouot" || item.platform.toLowerCase() === "leboncoin"
                                          ? `Bonjour, je vous contacte au sujet de votre lot "${item.title}". Serait-il possible d'obtenir de plus amples informations d'authenticité, notamment des photographies détaillées des assemblages de menuiserie, du dos du meuble et d'éventuelles signatures ou estampilles ? Merci beaucoup de votre professionnalisme.`
                                          : `Hello, I'm reaching out regarding your listing for "${item.title}". Could you please provide high-resolution close-up photographs showing the joinery/mortises, the back/underside paneling, and any maker marks or hallmarks to help me verify the era authenticity? Thank you in advance for your assistance.`;
                                        navigator.clipboard.writeText(draftText);
                                        setCopiedDraftIndex(index);
                                        setTimeout(() => setCopiedDraftIndex(null), 2000);
                                      }}
                                      className="absolute right-2.5 bottom-2.5 bg-ink hover:opacity-90 text-paper text-[10px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-all"
                                    >
                                      {copiedDraftIndex === index ? (
                                        <>
                                          <Check className="w-3 h-3 text-emerald-400" />
                                          <span>Msg Copied Code</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3 h-3 text-paper/80" />
                                          <span>Copy Message Draft</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-paper border border-border-custom rounded-3xl p-8 text-center text-muted text-xs">
                {t('hunter.no_verified')}
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
