import React from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, User, Bell, Settings } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  onViewChange?: (view: any) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onViewChange }) => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-gold/20 selection:text-ink">
      <nav className="fixed top-0 left-0 right-0 z-40 bg-paper/80 backdrop-blur-md border-b border-border-custom">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-white/50 rounded-full transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2">
            <button 
              onClick={() => onViewChange?.('home')}
              className="serif text-xl tracking-tight font-light text-ink"
            >
              {t('common.app_name')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => onViewChange?.('settings')}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-white/50 rounded-full transition-colors">
              <User className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      <main className="pt-16">
        {children}
      </main>
    </div>
  );
};
