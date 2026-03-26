import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, Search, History, Settings, Sparkles, ArrowRight, Upload, Mic, X, BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HomeProps {
  onScan: () => void;
  onUpload: () => void;
  onDescribe: (autoListen?: boolean) => void;
  onViewCollection: () => void;
  onViewSettings: () => void;
}

export const Home: React.FC<HomeProps> = ({ onScan, onUpload, onDescribe, onViewCollection, onViewSettings }) => {
  const { t } = useTranslation();
  const [showAllTips, setShowAllTips] = useState(false);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);

  const isSpeechSupported = !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  const tips = [
    { id: 1, title: t('home.tip_joints_title'), desc: t('home.tip_joints_desc') },
    { id: 2, title: t('home.tip_glass_title'), desc: t('home.tip_glass_desc') },
    { id: 3, title: t('home.tip_veneer_title', 'Veneer Thickness'), desc: t('home.tip_veneer_desc', 'Check the edges. Thick veneer (1-2mm) usually means pre-1850. Paper-thin is modern.') },
    { id: 4, title: t('home.tip_hardware_title', 'Hardware Audit'), desc: t('home.tip_hardware_desc', 'Look behind the handles. Extra holes suggest the hardware was replaced, affecting value.') },
    { id: 5, title: t('home.tip_smell_title', 'The Smell Test'), desc: t('home.tip_smell_desc', 'Old wood has a distinct, musty but not rotten smell. New stains smell like chemicals.') }
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-32">
      {/* Hero Section */}
      <section className="space-y-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/10 text-gold rounded-full border border-gold/20">
          <Sparkles className="w-3 h-3" />
          <span className="text-[9px] uppercase tracking-widest font-bold">{t('describe.try_item')}</span>
        </div>
        <h1 className="serif text-5xl font-light tracking-tight leading-tight text-ink">{t('home.hero_title')}</h1>
        <p className="text-muted max-w-md mx-auto leading-relaxed">
          {t('home.hero_desc')}
        </p>
      </section>

      {/* Main Input Actions */}
      <section className="space-y-6">
        <div className="grid grid-cols-1 gap-4">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={onScan}
            className="group relative h-48 rounded-[32px] overflow-hidden bg-ink text-paper shadow-2xl shadow-ink/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-ink/80 to-ink" />
            <div className="absolute inset-0 flex items-center justify-between p-8">
              <div className="space-y-2 text-left">
                <h2 className="serif text-3xl font-light">{t('common.scan')}</h2>
                <p className="text-[10px] text-paper/40 uppercase tracking-widest font-bold">{t('home.scan_subtitle')}</p>
              </div>
              <div className="p-5 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
                <Camera className="w-8 h-8" />
              </div>
            </div>
          </motion.button>

          <div className="grid grid-cols-2 gap-4">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onUpload}
              className="group p-8 bg-white border border-border-custom rounded-[32px] text-left space-y-4 shadow-sm hover:shadow-xl transition-all"
            >
              <div className="p-4 bg-paper rounded-2xl w-fit group-hover:bg-border-custom transition-colors">
                <Upload className="w-6 h-6 text-muted" />
              </div>
              <div className="space-y-1">
                <h3 className="serif text-xl font-light text-ink">{t('common.upload')}</h3>
                <p className="text-[9px] text-muted uppercase tracking-widest font-bold">{t('home.upload_subtitle')}</p>
              </div>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onDescribe(false)}
              className="group p-8 bg-white border border-border-custom rounded-[32px] text-left space-y-4 shadow-sm hover:shadow-xl transition-all"
            >
              <div className="p-4 bg-paper rounded-2xl w-fit group-hover:bg-border-custom transition-colors">
                <Search className="w-6 h-6 text-muted" />
              </div>
              <div className="space-y-1">
                <h3 className="serif text-xl font-light text-ink">{t('common.describe')}</h3>
                <p className="text-[9px] text-muted uppercase tracking-widest font-bold">{t('home.describe_subtitle')}</p>
              </div>
            </motion.button>
          </div>

          {isSpeechSupported && (
            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onDescribe(true)}
              className="group relative h-24 rounded-[24px] overflow-hidden bg-white border border-border-custom shadow-sm hover:shadow-md transition-all"
            >
              <div className="absolute inset-0 flex items-center justify-between px-8">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gold/10 rounded-xl group-hover:bg-gold/20 transition-colors">
                    <Mic className="w-5 h-5 text-gold" />
                  </div>
                  <div className="text-left">
                    <h3 className="serif text-lg font-light text-ink">{t('home.voice_appraisal')}</h3>
                    <p className="text-[9px] text-muted uppercase tracking-widest font-bold">{t('home.voice_appraisal_subtitle')}</p>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-muted group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.button>
          )}
        </div>
      </section>

      {/* Secondary Actions */}
      <section className="pt-4">
        <button 
          onClick={onViewCollection}
          className="w-full p-6 bg-paper rounded-[24px] flex items-center justify-between border border-border-custom hover:bg-border-custom transition-colors group"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white rounded-xl">
              <History className="w-5 h-5 text-muted" />
            </div>
            <div className="text-left">
              <h4 className="font-medium text-ink">{t('common.history')}</h4>
              <p className="text-[10px] text-muted uppercase tracking-widest font-bold">{t('home.history_subtitle')}</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-muted group-hover:translate-x-1 transition-transform" />
        </button>
      </section>

      {/* Quick Tips / Recent Finds */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="serif text-2xl font-light text-ink">{t('home.quick_tips')}</h2>
          <button 
            onClick={() => setShowAllTips(true)}
            className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-ink transition-colors flex items-center gap-2"
          >
            {t('common.view_all')} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-4">
          {tips.slice(0, 2).map((tip) => (
            <motion.div 
              key={tip.id}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedTip(tip.id)}
              className="p-6 bg-paper rounded-3xl flex items-start gap-4 border border-border-custom cursor-pointer hover:bg-white transition-colors"
            >
              <div className="w-2 h-2 rounded-full bg-gold mt-2" />
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-ink">{tip.title}</h4>
                <p className="text-xs text-muted leading-relaxed line-clamp-2">{tip.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Tips Modal */}
      <AnimatePresence>
        {showAllTips && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
            >
              <div className="p-8 border-b border-border-custom flex items-center justify-between sticky top-0 bg-white z-10">
                <div className="space-y-1">
                  <h3 className="serif text-2xl font-light text-ink">{t('home.quick_tips')}</h3>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-gold">{t('home.expert_field_knowledge', 'Expert Field Knowledge')}</p>
                </div>
                <button 
                  onClick={() => setShowAllTips(false)}
                  className="w-10 h-10 bg-paper rounded-full flex items-center justify-center hover:bg-border-custom transition-colors"
                >
                  <X className="w-5 h-5 text-ink" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {tips.map((tip) => (
                  <div 
                    key={tip.id}
                    className="p-6 bg-paper rounded-3xl space-y-2 border border-border-custom"
                  >
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gold" />
                      <h4 className="font-bold text-sm text-ink">{tip.title}</h4>
                    </div>
                    <p className="text-xs text-muted leading-relaxed">{tip.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Single Tip Detail Modal */}
      <AnimatePresence>
        {selectedTip !== null && !showAllTips && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-gold" />
              </div>
              
              <div className="space-y-4 text-center">
                <h3 className="serif text-2xl font-light text-ink">
                  {tips.find(t => t.id === selectedTip)?.title}
                </h3>
                <p className="text-muted leading-relaxed">
                  {tips.find(t => t.id === selectedTip)?.desc}
                </p>
              </div>

              <button 
                onClick={() => setSelectedTip(null)}
                className="w-full py-4 bg-ink text-paper rounded-2xl font-bold text-sm shadow-xl shadow-ink/20"
              >
                {t('describe.got_it')}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bottom Nav Placeholder */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-border-custom flex items-center justify-around">
        <button onClick={() => {}} className="p-3 text-ink"><Camera className="w-6 h-6" /></button>
        <button onClick={onViewCollection} className="p-3 text-muted/40 hover:text-ink transition-colors"><History className="w-6 h-6" /></button>
        <button onClick={onViewSettings} className="p-3 text-muted/40 hover:text-ink transition-colors"><Settings className="w-6 h-6" /></button>
      </div>
    </div>
  );
};
