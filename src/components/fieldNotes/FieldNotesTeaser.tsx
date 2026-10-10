import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { langOf, noteBody, noteTitle, teaserNotes, type NoteMatchInput } from '../../services/fieldNotes';
import { loadLocalFinds } from '../../services/localFinds';

export const FieldNotesTeaser: React.FC<{
  onOpenGuide: () => void;
  onOpenNote: (noteId: string) => void;
}> = ({ onOpenGuide, onOpenNote }) => {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const [selected, setSelected] = useState<string | null>(null);

  const tips = useMemo(() => {
    let recent: NoteMatchInput | null = null;
    try {
      const finds = loadLocalFinds();
      const last = finds[0];
      const items = last?.analysis ? (Array.isArray(last.analysis) ? last.analysis : last.analysis?.items || [last.analysis]) : [];
      const s = items[0]?.item_summary;
      if (s) {
        recent = {
          category: s.category,
          title: s.title,
          style: s.likely_style,
          period: s.likely_period,
          origin: s.likely_origin,
        };
      }
    } catch { /* ignore */ }
    return teaserNotes({ recent, count: 2 });
  }, []);

  const active = tips.find(n => n.id === selected) || null;

  return (
    <section className="space-y-6" data-testid="field-notes-teaser">
      <div className="flex items-center justify-between">
        <h2 className="serif text-2xl font-light text-ink">{t('home.quick_tips')}</h2>
        <button
          type="button"
          onClick={onOpenGuide}
          className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-ink transition-colors flex items-center gap-2"
          data-testid="field-notes-view-all"
        >
          {t('field_notes.view_guide')} <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <div className="space-y-4">
        {tips.map(tip => (
          <motion.button
            key={tip.id}
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setSelected(tip.id)}
            className="w-full text-left p-6 bg-paper rounded-3xl flex items-start gap-4 border border-border-custom hover:bg-white transition-colors"
            data-testid={`field-notes-teaser-${tip.id}`}
          >
            <div className="w-2 h-2 rounded-full bg-gold mt-2 shrink-0" />
            <div className="space-y-1 min-w-0">
              <h4 className="font-medium text-sm text-ink">{noteTitle(tip, lang)}</h4>
              <p className="text-xs text-muted leading-relaxed line-clamp-2">{noteBody(tip, lang)}</p>
            </div>
          </motion.button>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-full max-w-sm rounded-[40px] p-8 space-y-6 shadow-2xl"
            >
              <div className="w-16 h-16 bg-gold/10 rounded-2xl flex items-center justify-center mx-auto">
                <BookOpen className="w-8 h-8 text-gold" />
              </div>
              <div className="space-y-3 text-center">
                <h3 className="serif text-2xl font-light text-ink">{noteTitle(active, lang)}</h3>
                <p className="text-muted leading-relaxed text-sm">{noteBody(active, lang)}</p>
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => { setSelected(null); onOpenNote(active.id); }}
                  className="w-full py-4 bg-ink text-paper rounded-2xl font-bold text-sm"
                >
                  {t('field_notes.open_in_guide')}
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="w-full py-3 text-sm text-muted font-medium"
                >
                  {t('describe.got_it')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
};

export default FieldNotesTeaser;
