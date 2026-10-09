// "Before you buy": what to check and confirm for THIS piece (type, period, maker claim, verdict). Each item can be
// answered Yes / No / Not sure; "Re-run with my answers" re-appraises with them (see checklist.ts).
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import type { CheckAnswer, CheckAnswers, CheckItem } from '../services/checklist';

export const BeforeYouBuy: React.FC<{
  items: CheckItem[]; answers?: CheckAnswers; embedded?: boolean; onRerun?: (answers: CheckAnswers) => void;
}> = ({ items, answers: initial, embedded, onRerun }) => {
  const { t } = useTranslation();
  const [answers, setAnswers] = useState<CheckAnswers>(initial || {});
  useEffect(() => { setAnswers(initial || {}); }, [JSON.stringify(initial || {})]);
  if (!items?.length) return null;
  const set = (id: CheckItem['id'], a: CheckAnswer) => setAnswers(prev => ({ ...prev, [id]: prev[id] === a ? undefined : a }));
  const answered = Object.values(answers).filter(Boolean).length;
  const changed = JSON.stringify(answers) !== JSON.stringify(initial || {});
  const label = (it: CheckItem) => {
    const v: Record<string, any> = { ...(it.vars || {}) };
    if (v.where) v.where = t(`checklist.where.${v.where}`);
    if (it.id === 'invoice_wording') v.wording = v.maker ? t('checklist.invoice_with_maker', { maker: v.maker, period: v.period || '…' }) : t('checklist.invoice_no_maker', { period: v.period || '…' });
    return String(t(`checklist.items.${it.id}`, v));
  };
  const btn = (on: boolean, tone: string) => `px-3 py-1.5 rounded-full text-[11px] font-bold border transition-all ${on ? tone : 'bg-paper text-muted border-border-custom'}`;
  return (
    <section data-testid="before-you-buy" className={embedded ? 'pt-2 space-y-3' : 'p-6 bg-white border border-border-custom rounded-[32px] space-y-4 shadow-sm'}>
      <div className="flex items-center gap-2 text-ink">
        <ClipboardCheck className="w-5 h-5 text-gold" />
        <h3 className={embedded ? 'text-sm font-bold uppercase tracking-widest' : 'serif text-2xl font-normal'}>{t(embedded ? 'checklist.title_embedded' : 'checklist.title')}</h3>
      </div>
      <p className="text-xs text-muted leading-relaxed">{t('checklist.intro')}</p>
      <ul className="space-y-3">
        {items.map(it => (
          <li key={it.id} data-testid={`check-${it.id}`} className="space-y-1.5">
            <p className={`text-sm leading-snug ${it.important ? 'text-ink font-medium' : 'text-ink/80'}`}>{it.important ? '• ' : '◦ '}{label(it)}</p>
            <div className="flex gap-2" role="group" aria-label={label(it)}>
              <button type="button" data-testid={`check-${it.id}-yes`} aria-pressed={answers[it.id] === 'yes'} onClick={() => set(it.id, 'yes')} className={btn(answers[it.id] === 'yes', 'bg-emerald-600 text-white border-emerald-600')}>{t('checklist.yes')}</button>
              <button type="button" data-testid={`check-${it.id}-no`} aria-pressed={answers[it.id] === 'no'} onClick={() => set(it.id, 'no')} className={btn(answers[it.id] === 'no', 'bg-red-600 text-white border-red-600')}>{t('checklist.no')}</button>
              <button type="button" data-testid={`check-${it.id}-unsure`} aria-pressed={answers[it.id] === 'unsure'} onClick={() => set(it.id, 'unsure')} className={btn(answers[it.id] === 'unsure', 'bg-amber-500 text-white border-amber-500')}>{t('checklist.unsure')}</button>
            </div>
          </li>
        ))}
      </ul>
      {onRerun && (
        <button type="button" data-testid="checklist-rerun" disabled={answered === 0 || !changed}
          onClick={(e) => { e.preventDefault(); onRerun(Object.fromEntries(Object.entries(answers).filter(([, a]) => a)) as CheckAnswers); }}
          className="w-full py-3 bg-ink text-paper rounded-full font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-40">
          <RefreshCw className="w-4 h-4" />
          {t('checklist.rerun', { count: answered })}
        </button>
      )}
    </section>
  );
};
