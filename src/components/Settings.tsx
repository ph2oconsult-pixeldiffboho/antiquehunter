import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Globe, User, LogOut, Info, ChevronRight } from 'lucide-react';
import { auth } from '../firebase';

interface SettingsProps {
  onBack: () => void;
  plan: 'free' | 'pro' | 'dealer';
  onUpgrade: (plan: 'free' | 'pro' | 'dealer') => void;
}

export const Settings: React.FC<SettingsProps> = ({ onBack, plan, onUpgrade }) => {
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
          className="p-3 bg-white border border-zinc-100 rounded-2xl text-zinc-400 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="serif text-3xl font-light">{t('settings.title')}</h1>
      </header>

      <div className="space-y-8">
        {/* Profile */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-2">{t('settings.profile')}</h2>
          <div className="bg-white border border-zinc-100 rounded-[32px] overflow-hidden">
            <div className="p-6 flex items-center gap-4 border-b border-zinc-50">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center overflow-hidden">
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-zinc-400" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-medium text-zinc-900">{auth.currentUser?.displayName || 'Antique Hunter'}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-zinc-500">{auth.currentUser?.email}</p>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase tracking-widest rounded-full">{plan}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="w-full p-6 flex items-center gap-4 text-rose-600 hover:bg-rose-50 transition-colors text-left"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('settings.sign_out')}</span>
            </button>
          </div>
        </section>

        {/* Plan Selection */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-2">Subscription Plan</h2>
          <div className="bg-white border border-zinc-100 rounded-[32px] overflow-hidden">
            {plans.map((p) => (
              <button
                key={p.id}
                onClick={() => onUpgrade(p.id as any)}
                className={`w-full p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0 ${
                  plan === p.id ? 'bg-zinc-50' : ''
                }`}
              >
                <div className="flex flex-col items-start">
                  <div className="flex items-center gap-2">
                    <span className={`font-medium ${plan === p.id ? 'text-zinc-900' : 'text-zinc-500'}`}>
                      {p.name}
                    </span>
                    {plan === p.id && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  </div>
                  <span className="text-xs text-zinc-400">{p.desc}</span>
                </div>
                {plan === p.id ? (
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active</span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-zinc-300" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Language Selection */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-2">{t('settings.language')}</h2>
          <div className="bg-white border border-zinc-100 rounded-[32px] overflow-hidden">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full p-6 flex items-center justify-between hover:bg-zinc-50 transition-colors border-b border-zinc-50 last:border-0 ${
                  i18n.language === lang.code ? 'bg-amber-50/50' : ''
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${i18n.language === lang.code ? 'bg-amber-400' : 'bg-transparent'}`} />
                  <span className={`font-medium ${i18n.language === lang.code ? 'text-zinc-900' : 'text-zinc-500'}`}>
                    {lang.name}
                  </span>
                </div>
                {i18n.language === lang.code && <Globe className="w-4 h-4 text-amber-500" />}
              </button>
            ))}
          </div>
        </section>

        {/* About */}
        <section className="space-y-4">
          <h2 className="text-[10px] uppercase tracking-widest font-bold text-zinc-400 px-2">{t('settings.about')}</h2>
          <div className="bg-white border border-zinc-100 rounded-[32px] p-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Version</span>
              <span className="font-medium text-zinc-900">1.0.0</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-500">Legal</span>
              <ChevronRight className="w-4 h-4 text-zinc-300" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
