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
        className="flex items-center gap-2 text-zinc-500 hover:text-zinc-900 transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        <span className="text-sm font-medium">{t('common.back')}</span>
      </button>

      <div className="mb-8">
        <h1 className="serif text-3xl mb-2 tracking-tight">{t('describe.title')}</h1>
        <p className="text-zinc-500 text-sm">{t('home.describe_subtitle')}</p>
      </div>

      <div className="mb-8 space-y-4">
        <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{t('describe.images')}</label>
        <div className="flex flex-wrap gap-3">
          {images.map((img, index) => (
            <div key={index} className="relative w-20 h-20 rounded-xl overflow-hidden group">
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
            className="w-20 h-20 rounded-xl border-2 border-dashed border-zinc-200 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:border-amber-500 hover:text-amber-500 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="text-[8px] font-bold uppercase tracking-tighter">{t('describe.add_more')}</span>
          </button>
        </div>

        {isDetailedScan && (
          <div className="bg-amber-50/50 rounded-2xl p-4 border border-amber-100/50">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">{t('describe.suggested_shots')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                t('describe.shot_overall'),
                t('describe.shot_mark'),
                t('describe.shot_back'),
                t('describe.shot_detail')
              ].map((shot, i) => (
                <div key={i} className="flex items-center gap-2 text-[11px] text-amber-800/70">
                  <div className="w-1 h-1 rounded-full bg-amber-400" />
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
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-2">
              <Tag className="w-3 h-3" />
              {t('describe.category')}
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as AntiqueCategory)}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm appearance-none cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{t(`categories.${cat}`)}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              {t('describe.location')}
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t('describe.location_placeholder')}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{t('common.describe')}</label>
            {isSpeechSupported && (
              <button
                type="button"
                onClick={toggleListening}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-all ${
                  isListening 
                    ? 'bg-rose-100 text-rose-600 animate-pulse' 
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
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
              className={`w-full h-40 p-4 bg-zinc-50 border rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none text-sm leading-relaxed ${
                isListening ? 'border-amber-400 ring-2 ring-amber-500/10' : 'border-zinc-100'
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
                        className="w-1 bg-amber-500 rounded-full"
                      />
                    ))}
                  </div>
                  <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Listening...</span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{t('describe.asking_price')}</label>
              <div className="flex bg-zinc-100 rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => setPriceType('offered')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${priceType === 'offered' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}
                >
                  {t('describe.price_offered')}
                </button>
                <button
                  type="button"
                  onClick={() => setPriceType('paid')}
                  className={`px-3 py-1 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all ${priceType === 'paid' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400'}`}
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
                className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                <select 
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="bg-transparent text-xs font-bold text-zinc-400 focus:outline-none cursor-pointer"
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
            <label className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{t('describe.seller_type')}</label>
            <select
              value={sellerType}
              onChange={(e) => setSellerType(e.target.value)}
              className="w-full p-4 bg-zinc-50 border border-zinc-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-sm appearance-none cursor-pointer"
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
          className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm hover:bg-zinc-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-zinc-900/10"
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
