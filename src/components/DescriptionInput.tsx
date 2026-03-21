import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Send, Plus, X, Camera, MapPin, Tag, Mic, MicOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AntiqueCategory } from '../services/gemini';

interface DescriptionInputProps {
  onBack: () => void;
  onAnalyze: (description: string, details: any) => void;
  isAnalyzing: boolean;
  images: string[];
  isDetailedScan?: boolean;
  onAddImage: () => void;
  onRemoveImage: (index: number) => void;
}

export const DescriptionInput: React.FC<DescriptionInputProps> = ({ 
  onBack, 
  onAnalyze, 
  isAnalyzing,
  images,
  isDetailedScan,
  onAddImage,
  onRemoveImage
}) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [priceType, setPriceType] = useState<'offered' | 'paid'>('offered');
  const [currency, setCurrency] = useState('USD');
  const [sellerType, setSellerType] = useState('Market/Fair');
  const [category, setCategory] = useState<AntiqueCategory>('unknown');
  const [location, setLocation] = useState('');
  const [isListening, setIsListening] = useState(false);

  const toggleListening = () => {
    if (isListening) {
      // In a real implementation with a persistent recognition object, we'd stop it here.
      // For this simple implementation, we'll let it stop naturally or handle it via state.
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setDescription(prev => prev ? `${prev} ${transcript}` : transcript);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    try {
      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setIsListening(false);
    }
  };

  const isSpeechSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    onAnalyze(description, { 
      askingPrice: price ? parseFloat(price) : undefined, 
      priceType,
      currency, 
      sellerType,
      category,
      location
    });
  };

  const categories: AntiqueCategory[] = [
    'furniture', 
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
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </button>

      <div className="mb-8">
        <h1 className="serif text-3xl mb-2 tracking-tight text-ink">{t('describe.title')}</h1>
        <p className="text-muted text-sm">{t('home.describe_subtitle')}</p>
      </div>

      <div className="mb-8 space-y-4">
        <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('describe.images')}</label>
        <div className="flex flex-wrap gap-3">
          {images.map((img, index) => (
            <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden group border border-border-custom">
              <img src={img} alt="" className="w-full h-full object-cover" />
              <button 
                onClick={() => onRemoveImage(index)}
                className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button 
            onClick={onAddImage}
            className="w-20 h-20 rounded-xl border-2 border-dashed border-border-custom flex flex-col items-center justify-center gap-1 text-muted hover:border-gold hover:text-gold transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{t('describe.add_more')}</span>
          </button>
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

      <form onSubmit={handleSubmit} className="space-y-8">
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
            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
                  isListening 
                    ? 'bg-decision-red/10 text-decision-red animate-pulse' 
                    : 'bg-paper text-muted hover:bg-border-custom'
                }`}
              >
                {isListening ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                <span className="text-[9px] font-bold uppercase tracking-widest">
                  {isListening ? 'Listening...' : 'Speak details instead'}
                </span>
              </button>
            )}
          </div>
          <div className="relative">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={isListening ? 'Listening... Describe what you see' : t('describe.placeholder')}
              className={`w-full h-40 p-4 bg-paper border rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all resize-none text-sm leading-relaxed text-ink placeholder:text-muted/40 ${
                isListening ? 'border-gold ring-2 ring-gold/10' : 'border-border-custom'
              }`}
              required
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
                  <span className="text-[10px] font-bold text-gold uppercase tracking-widest">Listening...</span>
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
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0.00"
                className="w-full p-4 bg-paper border border-border-custom rounded-2xl focus:outline-none focus:ring-2 focus:ring-gold/20 focus:border-gold transition-all text-sm text-ink placeholder:text-muted/40"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <select 
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-xs font-bold text-muted focus:outline-none cursor-pointer"
                >
                  <option>USD</option>
                  <option>GBP</option>
                  <option>EUR</option>
                  <option>JPY</option>
                </select>
              </div>
            </div>
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

        <button
          type="submit"
          disabled={isAnalyzing || !description.trim()}
          className="w-full py-4 bg-ink text-paper rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-ink/10"
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
