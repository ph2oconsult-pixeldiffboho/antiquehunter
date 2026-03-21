import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Bell, Mail, Globe } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (alert: { query: string; email: string; region: string }) => void;
  initialQuery?: string;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, onClose, onSave, initialQuery = '' }) => {
  const [query, setQuery] = useState(initialQuery);
  const [email, setEmail] = useState('');
  const [region, setRegion] = useState('Global');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ query, email, region });
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-ink/40 backdrop-blur-sm z-50"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-[40px] p-12 shadow-2xl z-50 border border-border-custom"
          >
            <button
              onClick={onClose}
              className="absolute top-8 right-8 p-2 rounded-full hover:bg-paper transition-colors text-muted/40"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4 mb-8">
              <div className="p-4 bg-gold/10 rounded-2xl">
                <Bell className="w-6 h-6 text-gold" />
              </div>
              <div>
                <h2 className="serif text-3xl font-light text-ink">Set Global Alert</h2>
                <p className="text-xs text-muted uppercase tracking-widest font-semibold mt-1">Never miss a rare find</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-4">Item Description</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="e.g. 18th Century French Ormolu Clock"
                    className="w-full bg-paper border-none rounded-3xl px-8 py-5 text-lg placeholder:text-muted/20 focus:ring-2 focus:ring-gold/20 transition-all outline-none text-ink"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-4">Notification Email</label>
                <div className="relative">
                  <Mail className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/20" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full bg-paper border-none rounded-3xl pl-16 pr-8 py-5 text-lg placeholder:text-muted/20 focus:ring-2 focus:ring-gold/20 transition-all outline-none text-ink"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-widest font-bold text-muted ml-4">Search Region</label>
                <div className="relative">
                  <Globe className="absolute left-8 top-1/2 -translate-y-1/2 w-5 h-5 text-muted/20" />
                  <select
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    className="w-full bg-paper border-none rounded-3xl pl-16 pr-8 py-5 text-lg appearance-none focus:ring-2 focus:ring-gold/20 transition-all outline-none text-ink"
                  >
                    <option>Global</option>
                    <option>Europe</option>
                    <option>North America</option>
                    <option>Asia</option>
                    <option>Oceania</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-6 bg-ink text-paper rounded-full font-medium hover:opacity-90 transition-all shadow-xl shadow-ink/20 text-lg"
              >
                Activate Alert
              </button>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
