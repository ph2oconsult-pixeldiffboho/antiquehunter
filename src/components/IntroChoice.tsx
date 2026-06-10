import React from 'react';
import { motion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Compass, ShieldCheck, ArrowRight } from 'lucide-react';

interface IntroChoiceProps {
  onSelectValue: () => void;
  onSelectSource: () => void;
}

export const IntroChoice: React.FC<IntroChoiceProps> = ({ onSelectValue, onSelectSource }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12 pb-32 flex flex-col justify-center min-h-[80vh]">
      {/* Intro Header */}
      <section className="space-y-6 text-center">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 bg-gold/10 text-gold rounded-full border border-gold/20">
          <Sparkles className="w-3.5 h-3.5" />
          <span className="text-[10px] uppercase tracking-widest font-bold">
            {t('intro.welcome_badge', 'Professional Appraiser & Sourcing Engine')}
          </span>
        </div>
        
        <div className="space-y-3">
          <h1 className="serif text-5xl font-light tracking-tight leading-tight text-ink">
            {t('intro.welcome_title', 'What is your antique quest today?')}
          </h1>
          <p className="text-muted max-w-sm mx-auto text-sm leading-relaxed">
            {t('intro.welcome_desc', 'Choose your path to begin with specialist field intelligence.')}
          </p>
        </div>
      </section>

      {/* Elegant Choices Grid */}
      <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Path 1: Appraise / Value */}
        <motion.button
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSelectValue}
          className="group relative flex flex-col justify-between p-8 bg-white border border-border-custom rounded-[36px] text-left shadow-sm hover:shadow-xl hover:border-gold/30 transition-all min-h-[260px] cursor-pointer"
        >
          <div className="space-y-4">
            <div className="p-4 bg-gold/10 rounded-2xl w-fit group-hover:bg-gold/20 transition-colors">
              <Sparkles className="w-7 h-7 text-gold" />
            </div>
            <div className="space-y-2">
              <h3 className="serif text-2xl font-light text-ink">
                {t('intro.path_value_title', 'Appraise an Antique')}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {t('intro.path_value_desc', 'Determine real-world market values, check reproduction hazards, run safety audits, and generate instant valuation reports using smart camera or detailed descriptions.')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-gold font-bold text-[10px] uppercase tracking-widest pt-4 mt-auto">
            <span>{t('intro.path_value_action', 'Launch Appraisal')}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>

        {/* Path 2: Sourcing Client */}
        <motion.button
          whileHover={{ scale: 1.02, y: -4 }}
          whileTap={{ scale: 0.98 }}
          onClick={onSelectSource}
          className="group relative flex flex-col justify-between p-8 bg-gradient-to-br from-paper via-white to-gold/5 border border-gold/25 rounded-[36px] text-left shadow-sm hover:shadow-xl hover:border-gold/50 transition-all min-h-[260px] cursor-pointer"
        >
          <div className="space-y-4">
            <div className="p-4 bg-gold/10 rounded-2xl w-fit group-hover:bg-gold/20 transition-colors">
              <Compass className="w-7 h-7 text-gold animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="serif text-2xl font-light text-ink">
                {t('intro.path_hunt_title', 'Find Me an Antique')}
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                {t('intro.path_hunt_desc', 'Instruct our global live engine to scour Interencheres, Drouot, LeBonCoin, eBay, and elite houses in real-time to locate your desired antique piece.')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-gold font-bold text-[10px] uppercase tracking-widest pt-4 mt-auto">
            <span>{t('intro.path_hunt_action', 'Launch Sourcing Engine')}</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </motion.button>
      </section>

      {/* Assurance and Credentials info */}
      <footer className="pt-4 flex items-center justify-center gap-2 text-muted max-w-md mx-auto text-center">
        <ShieldCheck className="w-4 h-4 text-gold flex-shrink-0" />
        <span className="text-[10px] uppercase tracking-wider font-semibold">
          {t('intro.footer_assurance', 'Verified auction house feeds & expert ML-grounded insights.')}
        </span>
      </footer>
    </div>
  );
};
