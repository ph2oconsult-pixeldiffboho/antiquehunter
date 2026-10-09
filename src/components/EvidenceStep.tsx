// "Need more evidence" step: shown when the period is not established (see evidenceCheck in appraisalMath.ts).
// No firm buy verdict; asks, for this kind of piece, for the evidence that settles period vs later style / revival.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, SearchCheck } from 'lucide-react';
import type { EvidenceCheck } from '../services/appraisalMath';

export const EvidenceChecklist: React.FC<{ check: EvidenceCheck; compact?: boolean }> = ({ check, compact }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2" data-testid="evidence-checklist">
      <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} uppercase tracking-widest font-bold text-amber-900/70`}>
        {t(`evidence.kind.${check.pieceKind}`)} · {t('evidence.ask_title')}
      </p>
      <ul className="space-y-1.5">
        {check.asks.map(a => (
          <li key={a} className="flex items-start gap-2 text-sm text-ink">
            <Camera className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <span>{t(`evidence.asks.${a}`)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export const EvidenceStep: React.FC<{ check: EvidenceCheck; constructionSeen?: string; onAddEvidence?: () => void; children?: React.ReactNode }> = ({ check, constructionSeen, onAddEvidence, children }) => {
  const { t } = useTranslation();
  if (!check?.required) return null;
  return (
    <section data-testid="need-more-evidence" className="p-6 bg-amber-50 border-2 border-amber-300 rounded-[32px] space-y-4">
      <div className="flex items-center gap-2 text-amber-800">
        <SearchCheck className="w-5 h-5" />
        <h3 className="serif text-2xl font-normal">{t('evidence.title')}</h3>
      </div>
      <p className="text-sm text-ink leading-relaxed">{t('evidence.intro')}</p>
      <ul className="space-y-1">
        {check.reasons.map(r => (
          <li key={r} className="text-xs text-amber-900 italic">• {t(`evidence.reasons.${r}`)}</li>
        ))}
      </ul>
      {constructionSeen && !/^none/i.test(constructionSeen.trim()) && (
        <p className="text-xs text-muted"><span className="font-bold">{t('evidence.construction_seen')}:</span> {constructionSeen}</p>
      )}
      <EvidenceChecklist check={check} />
      {children}
      {onAddEvidence && (
        <button
          onClick={(e) => { e.preventDefault(); onAddEvidence(); }}
          className="w-full py-4 bg-ink text-paper rounded-full font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
        >
          <Camera className="w-5 h-5" />
          {t('evidence.button')}
        </button>
      )}
    </section>
  );
};
