import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Globe, User, LogOut, Info, ChevronRight } from 'lucide-react';
import { auth } from '../firebase';

interface SettingsProps {
  onBack: () => void;
  plan: 'free' | 'pro' | 'dealer';
  onUpgrade: (plan: 'free' | 'pro' | 'dealer') => void;
  currency: string;
  onCurrencyChange: (currency: string) => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, plan, onUpgrade, currency, onCurrencyChange }) => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  const languages = [
    { code: 'en', name: 'English' },
    { code: 'fr', name: 'Français' },
    { code: 'es', name: 'Español' },
    { code: 'de', name: 'Deutsch' }
  ];

  const currencies = [
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' }
  ];

  const plans = [
    { id: 'free', name: 'Free', desc: 'Basic analysis' },
    { id: 'pro', name: 'Pro', desc: 'Advanced market insights' },
    { id: 'dealer', name: 'Dealer', desc: 'Full commercial strategy' }
  ];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-12">
      <header className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-3 bg-white border border-border-custom rounded-2xl text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="serif text-3xl font-light text-ink">{t('settings.title')}</h1>
      </header>

      <div className="space-y-8">
        {/* Profile */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-muted px-2">{t('settings.profile')}</h2>
          <div className="bg-white border border-border-custom rounded-[32px] overflow-hidden">
            <div className="p-6 flex items-center gap-4 border-b border-paper">
              <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center overflow-hidden">
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-muted" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-ink">{auth.currentUser?.displayName || 'Antique Hunter'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted">{auth.currentUser?.email}</p>
                  <span className="px-1.5 py-0.5 bg-gold/10 text-gold text-[8px] font-bold uppercase tracking-widest rounded-full">{plan}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="w-full p-6 flex items-center gap-4 text-decision-red hover:bg-decision-red/5 transition-colors text-left"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('settings.sign_out')}</span>
            </button>
          </div>
        </section>

        {/* Plan Selection */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-muted px-2">Subscription Plan</h2>
          <div className="bg-white border border-border-custom rounded-[32px] overflow-hidden">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => onUpgrade(p.id as any)}
                className={`w-full p-6 flex items-center justify-between hover:bg-paper transition-colors border-b border-paper last:border-0 ${
                  plan === p.id ? 'bg-paper' : ''
                }`}
              >
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${plan === p.id ? 'text-ink' : 'text-muted'}`}>
                      {p.name}
                    </span>
                    {plan === p.id && <div className="w-1.5 h-1.5 rounded-full bg-gold" />}
                  </div>
                  <span className="text-xs text-muted">{p.desc}</span>
                </div>
                {plan === p.id ? (
                  <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Active</span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-muted/40" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Language Selection */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-muted px-2">{t('settings.language')}</h2>
          <div className="bg-white border border-border-custom rounded-[32px] overflow-hidden">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full p-6 flex items-center justify-between hover:bg-paper transition-colors border-b border-paper last:border-0 ${
                  i18n.language === lang.code ? 'bg-paper' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${i18n.language === lang.code ? 'bg-gold' : 'bg-transparent'}`} />
                  <span className={`font-medium ${i18n.language === lang.code ? 'text-ink' : 'text-muted'}`}>
                    {lang.name}
                  </span>
                </div>
                {i18n.language === lang.code && <Globe className="w-4 h-4 text-gold" />}
              </button>
            ))}
          </div>
        </section>

        {/* Currency Selection */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-muted px-2">Currency</h2>
          <div className="bg-white border border-border-custom rounded-[32px] overflow-hidden">
            <div className="grid grid-cols-2">
              {currencies.map((curr) => (
                <button
                  key={curr.code}
                  onClick={() => onCurrencyChange(curr.code)}
                  className={`p-6 flex flex-col items-start gap-1 hover:bg-paper transition-colors border-r border-b border-paper last:border-r-0 ${
                    currency === curr.code ? 'bg-paper' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-bold ${currency === curr.code ? 'text-gold' : 'text-muted'}`}>
                      {curr.symbol}
                    </span>
                    <span className={`font-medium ${currency === curr.code ? 'text-ink' : 'text-muted'}`}>
                      {curr.code}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted/60 font-medium">{curr.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* About */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-muted px-2">{t('settings.about')}</h2>
          <div className="bg-white border border-border-custom rounded-[32px] p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Version</span>
              <span className="font-medium text-ink">1.0.0</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Legal</span>
              <ChevronRight className="w-4 h-4 text-muted/40" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
