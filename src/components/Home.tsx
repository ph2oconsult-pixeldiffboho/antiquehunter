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
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full border border-amber-100">
          <Sparkles className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-widest font-bold">{t('home.hero_badge')}</span>
        </div>
        <h1 className="serif text-5xl font-light tracking-tight leading-tight">{t('home.hero_title')}</h1>
        <p className="text-zinc-500 max-w-md mx-auto leading-relaxed">
          {t('home.hero_desc')}
        </p>
      </section>

      {/* Main Actions */}
      <section className="grid grid-cols-1 gap-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onScan}
            className="group relative h-64 rounded-[40px] overflow-hidden bg-zinc-900 text-white shadow-2xl shadow-zinc-900/20"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-900" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
              <div className="p-6 bg-white/10 rounded-full group-hover:bg-white/20 transition-colors">
                <Camera className="w-10 h-10" />
              </div>
              <div className="space-y-2 text-center">
                <h2 className="serif text-3xl font-light">{t('common.scan')}</h2>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">{t('home.scan_subtitle')}</p>
              </div>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onUpload}
            className="group relative h-64 rounded-[40px] overflow-hidden bg-white border border-zinc-100 shadow-sm hover:shadow-xl transition-all"
          >
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-8">
              <div className="p-6 bg-zinc-50 rounded-full group-hover:bg-zinc-100 transition-colors">
                <Upload className="w-10 h-10 text-zinc-400" />
              </div>
              <div className="space-y-2 text-center">
                <h2 className="serif text-3xl font-light text-zinc-900">{t('common.upload')}</h2>
                <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">{t('home.upload_subtitle')}</p>
              </div>
            </div>
          </motion.button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onDescribe}
            className="p-8 bg-white border border-zinc-100 rounded-[40px] text-left space-y-6 shadow-sm hover:shadow-xl transition-all"
          >
            <div className="p-4 bg-zinc-50 rounded-2xl w-fit">
              <Search className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="space-y-1">
              <h3 className="serif text-xl font-light">{t('common.describe')}</h3>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">{t('home.describe_subtitle')}</p>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onViewCollection}
            className="p-8 bg-white border border-zinc-100 rounded-[40px] text-left space-y-6 shadow-sm hover:shadow-xl transition-all"
          >
            <div className="p-4 bg-zinc-50 rounded-2xl w-fit">
              <History className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="space-y-1">
              <h3 className="serif text-xl font-light">{t('common.history')}</h3>
              <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">{t('home.history_subtitle')}</p>
            </div>
          </motion.button>
        </div>
      </section>

      {/* Quick Tips / Recent Finds */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="serif text-2xl font-light">{t('home.quick_tips')}</h2>
          <button className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 hover:text-zinc-600 transition-colors flex items-center gap-2">
            {t('common.view_all')} <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="space-y-4">
          {[
            { title: t('home.tip_joints_title'), desc: t('home.tip_joints_desc') },
            { title: t('home.tip_glass_title'), desc: t('home.tip_glass_desc') }
          ].map((tip, i) => (
            <div key={i} className="p-6 bg-zinc-50 rounded-3xl flex items-start gap-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 mt-2" />
              <div className="space-y-1">
                <h4 className="font-medium text-sm">{tip.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Bottom Nav Placeholder */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-white/80 backdrop-blur-md border-t border-zinc-100 flex items-center justify-around">
        <button onClick={() => {}} className="p-3 text-zinc-900"><Camera className="w-6 h-6" /></button>
        <button onClick={onViewCollection} className="p-3 text-zinc-300 hover:text-zinc-600 transition-colors"><History className="w-6 h-6" /></button>
        <button onClick={onViewSettings} className="p-3 text-zinc-300 hover:text-zinc-600 transition-colors"><Settings className="w-6 h-6" /></button>
      </div>
    </div>
  );
};
