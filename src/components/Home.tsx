import React from 'react';
import { motion } from 'motion/react';
import { Camera, Search, History, Settings, Sparkles, ArrowRight, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface HomeProps {
  onScan: () => void;
  onUpload: () => void;
  onDescribe: () => void;
  onViewCollection: () => void;
  onViewSettings: () => void;
}

export const Home: React.FC<HomeProps> = ({ onScan, onUpload, onDescribe, onViewCollection, onViewSettings }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-32">
      {/* Hero Section */}
      <section className="space-y-6 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-gold/10 text-gold rounded-full border border-gold/20">
          <Sparkles className="w-3 h-3" />
          <span className="text-[9px] uppercase tracking-widest font-bold">Try an item — even something nearby</span>
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
              onClick={onDescribe}
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
          <button className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-ink transition-colors flex items-center gap-2">
            {t('common.view_all')} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-4">
          {[
            { title: t('home.tip_joints_title'), desc: t('home.tip_joints_desc') },
            { title: t('home.tip_glass_title'), desc: t('home.tip_glass_desc') }
          ].map((tip, i) => (
            <div key={i} className="p-6 bg-paper rounded-3xl flex items-start gap-4 border border-border-custom">
              <div className="w-2 h-2 rounded-full bg-gold mt-2" />
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-ink">{tip.title}</h4>
                <p className="text-xs text-muted leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Nav Placeholder */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-border-custom flex items-center justify-around">
        <button onClick={() => {}} className="p-3 text-ink"><Camera className="w-6 h-6" /></button>
        <button onClick={onViewCollection} className="p-3 text-muted/40 hover:text-ink transition-colors"><History className="w-6 h-6" /></button>
        <button onClick={onViewSettings} className="p-3 text-muted/40 hover:text-ink transition-colors"><Settings className="w-6 h-6" /></button>
      </div>
    </div>
  );
};
