import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, ArrowRight } from 'lucide-react';
import { langOf, matchNotesForPiece, noteTitle, type NoteMatchInput } from '../../services/fieldNotes';
import { FieldNoteIllustration } from './FieldNoteIllustration';

export const FieldNotesForPiece: React.FC<{
  item: any;
  onOpenGuide: (opts: { noteId?: string; category?: string }) => void;
}> = ({ item, onOpenGuide }) => {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const summary = item?.item_summary || {};
  const maker = item?.maker || summary?.maker || null;
  const input: NoteMatchInput = {
    category: summary.category,
    title: summary.title,
    style: summary.likely_style,
    period: summary.likely_period,
    origin: summary.likely_origin,
    makerText: typeof maker === 'string' ? maker : [maker?.name, maker?.status].filter(Boolean).join(' '),
    hasMakerClaim: !!(maker && (maker.name || maker.status || maker.status === 'stamped_confirmed')),
  };
  const ranked = matchNotesForPiece(input, 5);
  if (!ranked.length) return null;

  return (
    <section className="p-6 bg-white border border-border-custom rounded-[32px] shadow-sm space-y-4" data-testid="field-notes-for-piece">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-gold" />
          <h3 className="serif text-2xl font-normal text-ink">{t('field_notes.for_piece_title')}</h3>
        </div>
        <button
          type="button"
          onClick={() => onOpenGuide({})}
          className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-ink flex items-center gap-1"
        >
          {t('field_notes.open_guide')} <ArrowRight className="w-3 h-3" />
        </button>
      </div>
      <p className="text-xs text-muted leading-relaxed">{t('field_notes.for_piece_intro')}</p>
      <ul className="space-y-2">
        {ranked.map(({ note }) => (
          <li key={note.id}>
            <button
              type="button"
              onClick={() => onOpenGuide({ noteId: note.id, category: note.category })}
              className="w-full text-left flex gap-3 p-3 rounded-2xl bg-paper border border-border-custom hover:border-gold/30 transition-colors"
              data-testid={`field-notes-for-piece-${note.id}`}
            >
              <div className="w-16 shrink-0">
                <FieldNoteIllustration id={note.illustration} lazy />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink leading-snug">{noteTitle(note, lang)}</p>
                <p className="text-[11px] text-muted line-clamp-2 mt-0.5">{note.body[lang]}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default FieldNotesForPiece;
