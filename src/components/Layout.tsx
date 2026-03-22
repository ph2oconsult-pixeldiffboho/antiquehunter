import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Menu, User, Settings, Home, BookOpen } from 'lucide-react';
import Logo from './LogoComponent';

interface LayoutProps {
  children: React.ReactNode;
  onViewChange?: (view: any) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, onViewChange }) => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { label: t('common.home', 'Home'), view: 'home', icon: Home },
    { label: t('common.collection', 'Collection'), view: 'collection', icon: BookOpen },
    { label: t('common.settings', 'Settings'), view: 'settings', icon: Settings },
    { label: t('common.profile', 'Profile'), view: 'profile', icon: User },
  ];

  return (
    <div className="min-h-screen bg-paper text-ink selection:bg-gold/20 selection:text-ink">
      <nav className="fixed top-0 left-0 right-0 z-40 bg-paper/80 backdrop-blur-md border-b border-border-custom">
        <div className="max-w-2xl mx-auto flex items-center justify-between h-16 px-6">
          <div className="flex items-center gap-4 relative">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            {isMenuOpen && (
              <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-border-custom rounded-2xl shadow-xl z-50 py-2">
                {menuItems.map((item) => (
                  <button
                    key={item.view}
                    onClick={() => {
                      onViewChange?.(item.view);
                      setIsMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper transition-colors text-sm font-medium text-ink"
                  >
                    <item.icon className="w-4 h-4 text-muted" />
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            <Logo className="w-6 h-6" />
            <button 
              onClick={() => onViewChange?.('home')}
              className="serif text-xl tracking-tight font-light text-ink"
            >
              {t('common.app_name', 'Antique Hunter')}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={() => onViewChange?.('settings')}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => onViewChange?.('profile')}
              className="p-2 hover:bg-white/50 rounded-full transition-colors"
            >
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
