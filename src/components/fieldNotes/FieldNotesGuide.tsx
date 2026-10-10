import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BookOpen, Search, X } from 'lucide-react';
import {
  CATEGORY_LABELS,
  FIELD_NOTES,
  PERIOD_TAG_LABELS,
  PIECE_TAG_LABELS,
  type FieldNote,
  type FieldNoteCategory,
  type PeriodTag,
  type PieceTag,
} from '../../content/fieldNotes';
import { filterNotes, langOf, noteBody, noteTitle, type FilterState } from '../../services/fieldNotes';
import { FieldNoteIllustration } from './FieldNoteIllustration';

export const FieldNotesGuide: React.FC<{
  onBack: () => void;
  initial?: FilterState & { noteId?: string };
}> = ({ onBack, initial }) => {
  const { t, i18n } = useTranslation();
  const lang = langOf(i18n.language);
  const [category, setCategory] = useState<FieldNoteCategory | 'all'>(initial?.category || 'all');
  const [pieceTag, setPieceTag] = useState<PieceTag | 'all'>(initial?.pieceTag || 'all');
  const [periodTag, setPeriodTag] = useState<PeriodTag | 'all'>(initial?.periodTag || 'all');
  const [query, setQuery] = useState(initial?.query || '');
  const [activeId, setActiveId] = useState<string | null>(initial?.noteId || null);

  const notes = useMemo(
    () => filterNotes({ category, pieceTag, periodTag, query }, lang),
    [category, pieceTag, periodTag, query, lang],
  );

  const active: FieldNote | undefined = activeId
    ? FIELD_NOTES.find(n => n.id === activeId) || notes.find(n => n.id === activeId)
    : undefined;

  const cats: Array<FieldNoteCategory | 'all'> = ['all', 'piece', 'period', 'stamps', 'buying'];

  if (active) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-6 pb-28" data-testid="field-note-detail">
        <header className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveId(null)}
            className="p-3 bg-white border border-border-custom rounded-2xl text-muted hover:text-ink"
            aria-label={t('common.back')}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-bold text-gold">
              {CATEGORY_LABELS[active.category][lang]}
            </p>
            <h1 className="serif text-2xl font-light text-ink leading-tight">{noteTitle(active, lang)}</h1>
          </div>
        </header>
        <FieldNoteIllustration id={active.illustration} />
        <p className="text-sm text-muted leading-relaxed whitespace-pre-wrap">{noteBody(active, lang)}</p>
        <p className="text-[10px] text-muted/60 italic">{t('field_notes.conservative_note')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-10 space-y-6 pb-28" data-testid="field-notes-guide">
      <header className="flex items-center gap-4">
        <button
          type="button"
          onClick={onBack}
          className="p-3 bg-white border border-border-custom rounded-2xl text-muted hover:text-ink"
          aria-label={t('common.back')}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-gold/10 rounded-xl">
            <BookOpen className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="serif text-3xl font-light text-ink">{t('field_notes.title')}</h1>
            <p className="text-[10px] uppercase tracking-widest font-bold text-muted">
              {t('field_notes.subtitle', { count: FIELD_NOTES.length })}
            </p>
          </div>
        </div>
      </header>

      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={t('field_notes.search_placeholder')}
          className="w-full pl-11 pr-10 py-3.5 bg-white border border-border-custom rounded-2xl text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:border-gold/40"
          data-testid="field-notes-search"
          aria-label={t('field_notes.search_placeholder')}
        />
        {query && (
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-muted" onClick={() => setQuery('')} aria-label="Clear">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label={t('field_notes.categories')}>
        {cats.map(c => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            onClick={() => { setCategory(c); setPieceTag('all'); setPeriodTag('all'); }}
            className={`shrink-0 px-3.5 py-2 rounded-full text-[11px] font-bold uppercase tracking-widest border transition-colors ${
              category === c ? 'bg-ink text-paper border-ink' : 'bg-white text-muted border-border-custom'
            }`}
            data-testid={`field-notes-cat-${c}`}
          >
            {c === 'all' ? t('field_notes.all') : CATEGORY_LABELS[c][lang]}
          </button>
        ))}
      </div>

      {category === 'piece' && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label={t('field_notes.piece_types')}>
          <Chip active={pieceTag === 'all'} onClick={() => setPieceTag('all')}>{t('field_notes.all')}</Chip>
          {(Object.keys(PIECE_TAG_LABELS) as PieceTag[]).map(tag => (
            <Chip key={tag} active={pieceTag === tag} onClick={() => setPieceTag(tag)} testId={`field-notes-piece-${tag}`}>
              {PIECE_TAG_LABELS[tag][lang]}
            </Chip>
          ))}
        </div>
      )}

      {category === 'period' && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="listbox" aria-label={t('field_notes.periods')}>
          <Chip active={periodTag === 'all'} onClick={() => setPeriodTag('all')}>{t('field_notes.all')}</Chip>
          {(Object.keys(PERIOD_TAG_LABELS) as PeriodTag[]).map(tag => (
            <Chip key={tag} active={periodTag === tag} onClick={() => setPeriodTag(tag)} testId={`field-notes-period-${tag}`}>
              {PERIOD_TAG_LABELS[tag][lang]}
            </Chip>
          ))}
        </div>
      )}

      <p className="text-xs text-muted">{t('field_notes.results_count', { count: notes.length })}</p>

      <ul className="space-y-3">
        {notes.map(n => (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => setActiveId(n.id)}
              className="w-full text-left p-4 bg-white border border-border-custom rounded-3xl hover:border-gold/30 hover:shadow-sm transition-all flex gap-4"
              data-testid={`field-note-card-${n.id}`}
            >
              <div className="w-24 shrink-0">
                <FieldNoteIllustration id={n.illustration} lazy />
              </div>
              <div className="min-w-0 space-y-1.5 py-0.5">
                <p className="text-[9px] uppercase tracking-widest font-bold text-gold">
                  {CATEGORY_LABELS[n.category][lang]}
                </p>
                <h2 className="serif text-lg font-light text-ink leading-snug">{noteTitle(n, lang)}</h2>
                <p className="text-xs text-muted leading-relaxed line-clamp-2">{noteBody(n, lang)}</p>
              </div>
            </button>
          </li>
        ))}
      </ul>

      {notes.length === 0 && (
        <div className="p-8 text-center text-sm text-muted bg-paper border border-border-custom rounded-3xl">
          {t('field_notes.empty')}
        </div>
      )}
    </div>
  );
};

const Chip: React.FC<{ active: boolean; onClick: () => void; children: React.ReactNode; testId?: string }> = ({
  active, onClick, children, testId,
}) => (
  <button
    type="button"
    onClick={onClick}
    data-testid={testId}
    className={`shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold tracking-wide border ${
      active ? 'bg-gold/15 text-gold border-gold/30' : 'bg-paper text-muted border-border-custom'
    }`}
  >
    {children}
  </button>
);

export default FieldNotesGuide;
