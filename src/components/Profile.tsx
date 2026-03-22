import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, User, LogOut, MessageSquare, ChevronRight } from 'lucide-react';
import { auth } from '../firebase';

interface ProfileProps {
  onBack: () => void;
  plan: 'free' | 'pro' | 'dealer';
  onSignOut: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onBack, plan, onSignOut }) => {
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
        <h1 className="serif text-3xl font-light text-ink">{t('profile.title', 'Profile')}</h1>
      </header>

      <section className="space-y-4">
        <div className="bg-white border border-border-custom rounded-[32px] overflow-hidden">
          <div className="p-6 flex items-center gap-4 border-b border-paper">
            <div className="w-16 h-16 rounded-full bg-paper flex items-center justify-center overflow-hidden">
              {auth.currentUser?.photoURL ? (
                <img src={auth.currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-muted" />
              )}
            </div>
            <div className="flex-1">
              <p className="text-lg font-medium text-ink">{auth.currentUser?.displayName || 'Antique Hunter'}</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted">{auth.currentUser?.email}</p>
                <span className="px-2 py-0.5 bg-gold/10 text-gold text-[10px] font-bold uppercase tracking-widest rounded-full">{plan}</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 border-b border-paper">
            <h3 className="text-sm font-bold text-ink mb-2">{t('profile.subscription', 'Subscription')}</h3>
            <p className="text-sm text-muted">{t('profile.current_plan', 'Current Plan')}: <span className="font-medium text-ink capitalize">{plan}</span></p>
          </div>

          <button 
            onClick={onSignOut}
            className="w-full p-6 flex items-center gap-4 text-decision-red hover:bg-decision-red/5 transition-colors text-left"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">{t('settings.sign_out')}</span>
          </button>
        </div>
      </section>
    </div>
  );
};
