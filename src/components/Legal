import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface LegalProps {
  onBack: () => void;
}

export const Legal: React.FC<LegalProps> = ({ onBack }) => {
  const { t } = useTranslation();

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
      <header className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-3 bg-white border border-border-custom rounded-2xl text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="serif text-3xl font-light text-ink">{t('legal.title', 'Legal')}</h1>
      </header>

      <div className="bg-white border border-border-custom rounded-[32px] p-8 space-y-6 text-ink">
        <section className="space-y-2">
          <h2 className="text-xl font-medium">Terms of Service</h2>
          <p className="text-muted text-sm leading-relaxed">
            By using Antique Hunter, you agree to these terms. This application is for informational purposes only and does not constitute professional appraisal advice.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">Privacy Policy</h2>
          <p className="text-muted text-sm leading-relaxed">
            We value your privacy. We only collect data necessary to provide you with accurate appraisals and improve our services. Your data is never sold to third parties.
          </p>
        </section>
        <section className="space-y-2">
          <h2 className="text-xl font-medium">Disclaimer</h2>
          <p className="text-muted text-sm leading-relaxed">
            Antique Hunter provides AI-generated appraisals based on public data. Actual market value may vary significantly. Always consult with a certified professional for high-value items.
          </p>
        </section>
      </div>
    </div>
  );
};
