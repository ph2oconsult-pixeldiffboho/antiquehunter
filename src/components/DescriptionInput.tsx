import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Send, Plus, X, Camera, MapPin, Tag, Mic, MicOff, Sparkles, Link as LinkIcon, Info, ChevronDown, ChevronUp, Gavel, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AntiqueCategory } from '../services/gemini';
import { parsePriceInput, sanitizePriceTyping } from '../services/appraisalMath';

interface DescriptionInputProps {
  onBack: () => void;
  onAnalyze: (description: string, details: any) => void;
  isAnalyzing: boolean;
  images: string[];
  isDetailedScan?: boolean;
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
  autoStartListening?: boolean;
  currency: string;
  onCurrencyChange?: (currency: string) => void;
}

export const DescriptionInput: React.FC<DescriptionInputProps> = ({ 
  onBack, 
  onAnalyze, 
  isAnalyzing,
  images,
  isDetailedScan,
  onAddImage,
  onRemoveImage,
  autoStartListening = false,
  currency: globalCurrency,
  onCurrencyChange
}) => {
  const { t, i18n } = useTranslation();
  const [showHint, setShowHint] = useState(() => {
    return localStorage.getItem('input_hint_shown') !== 'true';
  });
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [lotUrl, setLotUrl] = useState('');
  // Price is a text field (not type="number"): number inputs drop the whole value when you type "1 500" or "1,500",
  // which garbled fast typing. We keep digits/separators only and parse on submit.
  const [price, setPrice] = useState('');
  const [priceTouched, setPriceTouched] = useState(false);
  const priceInvalid = priceTouched && price.trim() !== '' && parsePriceInput(price) === null;
  const [priceType, setPriceType] = useState<'offered' | 'paid'>('offered');
  const [currency, setCurrency] = useState(globalCurrency);
  const [sellerType, setSellerType] = useState('Market/Fair');
  const [buyersPremium, setBuyersPremium] = useState('25');
  // Fix 5/9: decimal fees (28.8%) are accepted; a fee read from the lot page is used unless the user typed one
  const [premiumTouched, setPremiumTouched] = useState(false);
  const [category, setCategory] = useState<AntiqueCategory>('unknown');
  const [location, setLocation] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [hasAutoStarted, setHasAutoStarted] = useState(false);

  React.useEffect(() => {
    setCurrency(globalCurrency);
  }, [globalCurrency]);
  const isSpeechSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  // Auto-detect listing/auction links from either the dedicated lot URL input or the description.
  // Derived with useMemo (not setState in an effect on every keystroke): the old effect queued an extra
  // synchronous update per key press, and fast typing tripped React's "maximum update depth" guard,
  // dropping characters.
  const detected = React.useMemo(() => {
    const urlMatch = `${lotUrl} ${description}`.match(/(https?:\/\/[^\s]+)/i);
    if (!urlMatch) return null;
    const url = urlMatch[0].toLowerCase();
    let platformName = 'Online Listing';
    let isAuctionSite = false;
    if (url.includes('drouot')) { platformName = 'Drouot Paris'; isAuctionSite = true; }
    else if (url.includes('interencheres')) { platformName = 'Interencheres'; isAuctionSite = true; }
    else if (url.includes('saleroom')) { platformName = 'The Saleroom'; isAuctionSite = true; }
    else if (url.includes('liveauctioneers')) { platformName = 'LiveAuctioneers'; isAuctionSite = true; }
    else if (url.includes('sothebys')) { platformName = "Sotheby's"; isAuctionSite = true; }
    else if (url.includes('christies')) { platformName = "Christie's"; isAuctionSite = true; }
    else if (url.includes('bonhams')) { platformName = 'Bonhams'; isAuctionSite = true; }
    else if (url.includes('catawiki')) { platformName = 'Catawiki'; isAuctionSite = true; }
    else if (url.includes('auctionet')) { platformName = 'Auctionet'; isAuctionSite = true; }
    else if (url.includes('easyliveauction')) { platformName = 'easyLive Auction'; isAuctionSite = true; }
    else if (url.includes('ebay')) { platformName = 'eBay'; }
    else if (url.includes('leboncoin')) { platformName = 'LeBonCoin'; }
    else if (url.includes('1stdibs')) { platformName = '1stDibs'; }
    else if (url.includes('vinterior')) { platformName = 'Vinterior'; }
    return { platformName, isAuctionSite };
  }, [lotUrl, description]);
  const detectedPlatform = detected?.platformName ?? null;
  const detectedAuction = !!detected?.isAuctionSite;
  useEffect(() => {
    // only when an auction link first appears (not on every keystroke)
    if (detectedAuction) setSellerType(prev => (prev === 'Auction' ? prev : 'Auction'));
  }, [detectedAuction, detectedPlatform]);

  const toggleListening = () => {
    if (isListening) {
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    const langMap: Record<string, string> = {
      'en': 'en-US',
      'fr': 'fr-FR',
      'es': 'es-ES',
      'de': 'de-DE'
    };
    recognition.lang = langMap[i18n.language] || i18n.language || 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    try {
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  React.useEffect(() => {
    if (autoStartListening && isSpeechSupported && !hasAutoStarted) {
      setHasAutoStarted(true);
      toggleListening();
    }
  }, [autoStartListening, isSpeechSupported, hasAutoStarted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() && !lotUrl.trim()) return;
    
    if (showHint) {
      setShowHint(false);
      localStorage.setItem('input_hint_shown', 'true');
    }

    // Determine final lotUrl either from field or description
    const effectiveLotUrl = lotUrl.trim() || (description.match(/(https?:\/\/[^\s]+)/i)?.[0] || '');

    const parsedPrice = parsePriceInput(price);
    if (price.trim() && parsedPrice === null) {
      setPriceTouched(true);
      return; // validation message is shown under the field
    }

    onAnalyze(description, { 
      askingPrice: parsedPrice ?? undefined, 
      priceType,
      currency, 
      sellerType,
      category,
      location,
      lotUrl: effectiveLotUrl,
      buyerPremiumRate: sellerType === 'Auction' && buyersPremium ? parseFloat(buyersPremium) : undefined,
      premiumTouched,
    });
  };

  const categories: AntiqueCategory[] = [
    'furniture', 
    'bedroom_furniture',
    'chairs',
    'fine_wine',
    'mirrors',
    'watches',
    'jewellery',
    'chandelier_lighting', 
    'painting_art', 
    'sculpture_object', 
    'rug_textile', 
    'china_ceramic', 
    'decorative_object', 
    'unknown'
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <button 
        onClick={onBack}
        className="flex items-center gap-2 text-muted hover:text-ink transition-colors mb-8"
        aria-label="Go back to previous screen"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </button>

      <div className="mb-8">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/10 text-gold rounded-full border border-gold/20">
            <Sparkles className="w-3 h-3" />
            <span className="text-[9px] uppercase tracking-widest font-bold">{t('describe.try_item')}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setIsGuideOpen(!isGuideOpen);
              localStorage.setItem('guide_shown', 'true');
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border border-border-custom bg-paper hover:bg-stone-100 text-stone-700 transition-colors"
            aria-label="Toggle appraisal best practices guide"
          >
            <Info className="w-3.5 h-3.5 text-gold" />
            <span>{t('describe.hint_title', 'Appraisal Best Practices')}</span>
            {isGuideOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        {/* Non-intrusive Collapsible Guide */}
        <AnimatePresence>
          {isGuideOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-6 bg-paper border border-gold/30 rounded-2xl p-5 shadow-sm space-y-3"
            >
              <h3 className="serif text-lg font-medium text-ink">{t('describe.hint_title')}</h3>
              <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted">
                <li>{t('describe.hint_step1')}</li>
                <li>{t('describe.hint_step2')}</li>
                <li>{t('describe.hint_step3')}</li>
              </ol>
              <p className="text-xs text-ink font-medium pt-1">
                {t('describe.hint_footer')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsGuideOpen(false);
                  localStorage.setItem('guide_shown', 'true');
                }}
                className="py-1.5 px-4 bg-ink text-paper rounded-xl text-xs font-bold hover:opacity-90 transition-opacity"
              >
                {t('describe.got_it', 'Got it')}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <h1 className="serif text-4xl mb-1 tracking-tight text-ink">{t('describe.title')}</h1>
        <p className="text-[10px] text-muted uppercase tracking-widest font-bold mb-4">{t('describe.upload_photo_hint')}</p>
        <p className="text-muted text-sm leading-relaxed">{t('home.describe_subtitle')}</p>
        
        <AnimatePresence>
          {showHint && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 p-3 bg-paper border border-border-custom rounded-xl flex items-center gap-3"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse shrink-0" />
              <p className="text-xs text-muted italic">
                {t('describe.simple_start_hint')}
              </p>
              <button 
                onClick={() => {
                  setShowHint(false);
                  localStorage.setItem('input_hint_shown', 'true');
                }}
                className="ml-auto text-muted hover:text-ink"
                aria-label="Dismiss quick hint"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mb-8 space-y-4">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('describe.images')}</label>
        <div className="flex flex-wrap gap-3">
          <button 
            type="button"
            onClick={onAddImage}
            className="w-24 h-24 rounded-2xl border-2 border-dashed border-border-custom flex flex-col items-center justify-center gap-2 text-muted hover:border-gold hover:text-gold transition-all bg-paper/50"
            aria-label="Upload item photos"
          >
            <Camera className="w-6 h-6" />
            <span className="text-[9px] font-bold uppercase tracking-widest">{t('common.upload')}</span>
          </button>
          {images.map((img, index) => (
            <div key={index} className="relative w-24 h-24 rounded-2xl overflow-hidden group border border-border-custom shadow-sm">
              <img src={img} alt="Uploaded item" className="w-full h-full object-cover" />
              <button 
                type="button"
                onClick={() => onRemoveImage(index)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove photo ${index + 1}`}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {isDetailedScan && (
          <div className="bg-gold/5 rounded-2xl p-4 border border-gold/10">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-gold" />
              <span className="text-xs font-bold text-ink uppercase tracking-wider">{t('describe.suggested_shots')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                t('describe.shot_overall'),
                t('describe.shot_mark'),
                t('describe.shot_back'),
                t('describe.shot_detail')
              ].map((shot, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-muted">
                  <div className="w-1 h-1 rounded-full bg-gold/40" />
                  {shot}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Dedicated Auction or Listing Link Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted flex items-center gap-1.5">
              <LinkIcon className="w-3.5 h-3.5 text-gold" />
              <span>{t('describe.lot_url_label', 'Paste Auction or Listing Link (Lot Link)')}</span>
            </label>
            {detectedPlatform && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gold/15 text-gold text-[10px] font-bold rounded-full border border-gold/30">
                <Gavel className="w-3 h-3" />
                {detectedPlatform}
              </span>
            )}
          </div>
          <div className="relative">
            <input
              type="url"
              value={lotUrl}
              onChange={(e) => setLotUrl(e.target.value)}
              placeholder="https://www.drouot.com/l/... or Interencheres, Sotheby's, eBay, LeBonCoin, 1stDibs..."
              className="w-full p-4 pl-11 bg-paper border border-border-custom rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all text-xs text-ink placeholder:text-muted/40 font-mono shadow-sm"
              aria-label="Paste auction or listing link"
            />
            <LinkIcon className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <p className="text-[11px] text-muted flex items-center gap-1.5">
            <Info className="w-3 h-3 text-gold shrink-0" />
            <span>Paste a lot or listing link — the appraisal will prioritize fetching official estimates, lot dimensions, and catalog descriptions as the primary anchor.</span>
          </p>
          {sellerType === 'Auction' && (
            <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-2 flex items-center gap-2 font-medium">
              <Gavel className="w-3.5 h-3.5 shrink-0 text-amber-600" />
              <span>Auction Lot Mode: Appraisal factors in 20%–30% buyer's premium (frais de vente) and paddle ceiling rules.</span>
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted flex items-center gap-2">
              <Tag className="w-3 h-3" />
              {t('describe.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AntiqueCategory)}
              className="w-full p-4 bg-paper border border-border-custom rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all text-sm appearance-none cursor-pointer text-ink"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{t(`categories.${cat}`)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              {t('describe.location')}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('describe.location_placeholder')}
              className="w-full p-4 bg-paper border border-border-custom rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all text-sm text-ink placeholder:text-muted/40"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('common.describe')}</label>
            <div className="flex items-center gap-2">
              {!isSpeechSupported && (
                <span className="text-[9px] text-muted/60 italic">{t('describe.not_supported')}</span>
              )}
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all border shadow-sm ${
                    isListening 
                      ? 'bg-decision-red/10 text-decision-red border-decision-red/20 animate-pulse' 
                      : 'bg-paper text-muted border-border-custom hover:border-gold hover:text-gold'
                  }`}
                  aria-label={isListening ? "Stop voice listening" : "Start voice appraisal input"}
                >
                  {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span className="text-[10px] font-bold uppercase tracking-widest">
                    {isListening ? t('describe.stop_listening') : t('describe.voice_input')}
                  </span>
                </button>
              )}
            </div>
          </div>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isListening ? t('describe.listening_placeholder') : t('describe.placeholder')}
              className={`w-full h-36 p-4 bg-paper border rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all resize-none text-sm leading-relaxed text-ink placeholder:text-muted/40 ${
                isListening ? 'border-gold ring-2 ring-gold/10' : 'border-border-custom'
              }`}
              required={!lotUrl.trim()}
            />
            {isListening && (
              <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] rounded-2xl flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div
                        key={i}
                        animate={{ height: [8, 16, 8] }}
                        transition={{ repeat: Infinity, duration: 0.6, delay: i * 0.1 }}
                        className="w-1 bg-gold rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-gold uppercase tracking-widest">{t('describe.listening_label')}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('describe.asking_price')}</label>
              <div className="flex bg-paper rounded-lg p-0.5 border border-border-custom">
                <button
                  type="button"
                  onClick={() => setPriceType('offered')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${priceType === 'offered' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
                >
                  {t('describe.price_offered')}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceType('paid')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${priceType === 'paid' ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}
                >
                  {t('describe.price_paid')}
                </button>
              </div>
            </div>
            <div className="relative">
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={price}
                onChange={(e) => setPrice(sanitizePriceTyping(e.target.value))}
                onBlur={() => setPriceTouched(true)}
                placeholder="e.g. 1 500"
                aria-label={t('describe.asking_price')}
                aria-invalid={priceInvalid}
                data-testid="asking-price"
                className={`w-full p-4 pr-24 bg-paper border rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all text-sm text-ink placeholder:text-muted/40 ${priceInvalid ? 'border-decision-red' : 'border-border-custom'}`}
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <select 
                  value={currency}
                  onChange={(e) => { setCurrency(e.target.value); onCurrencyChange?.(e.target.value); }}
                  className="bg-transparent text-xs font-bold text-muted focus:outline-none cursor-pointer"
                >
                  <option>EUR</option>
                  <option>GBP</option>
                  <option>USD</option>
                  <option>SEK</option>
                  <option>AUD</option>
                  <option>CNY</option>
                  <option>JPY</option>
                </select>
              </div>
            </div>
            {priceInvalid && (
              <p className="text-[11px] text-decision-red font-medium" role="alert">{t('describe.price_invalid')}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('describe.seller_type')}</label>
            <select
              value={sellerType}
              onChange={(e) => setSellerType(e.target.value)}
              className="w-full p-4 bg-paper border border-border-custom rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all text-sm appearance-none cursor-pointer text-ink"
            >
              <option value="Market/Fair">{t('describe.seller_private')}</option>
              <option value="Antique Shop">{t('describe.seller_dealer')}</option>
              <option value="Auction">{t('describe.seller_auction')}</option>
            </select>
          </div>
        </div>

        {sellerType === 'Auction' && (
          <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest font-bold text-amber-900 flex items-center gap-1.5">
                <Gavel className="w-3.5 h-3.5 text-amber-700" />
                <span>Buyer's Premium % (Frais de Vente)</span>
              </label>
              <span className="text-[10px] font-semibold text-amber-800">Standard: 25% (France/UK)</span>
            </div>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="50"
                step="0.01"
                inputMode="decimal"
                value={buyersPremium}
                onChange={(e) => { setBuyersPremium(e.target.value.replace(',', '.')); setPremiumTouched(true); }}
                placeholder="25"
                className="w-full p-3.5 pr-8 bg-white border border-amber-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400 text-sm font-semibold text-stone-900"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">%</span>
            </div>
            <p className="text-[11px] text-amber-800/80 leading-tight">
              Includes auction house surcharge + VAT. Total out-of-pocket cost = Hammer Price × (1 + {Number((parseFloat(buyersPremium || '25') / 100).toFixed(4))}).
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={isAnalyzing || (!description.trim() && !/^https?:\/\/\S+/i.test(lotUrl.trim()))}
          className="w-full py-4 bg-ink text-paper rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-2xl shadow-ink/20"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              <span>{t('common.analyzing')}</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>{t('describe.analyze_button')}</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
};
