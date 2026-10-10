// Renders the split evidence ledger: facts, claims, photo features, hypotheses, unknowns, graded defects.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Camera, HelpCircle, AlertTriangle, Quote, Lightbulb } from 'lucide-react';
import type { EvidenceLedger, DefectSeverity } from '../services/evidenceLedger';
import { ledgerHasContent } from '../services/evidenceLedger';

const sevClass: Record<DefectSeverity, string> = {
  minor: 'bg-amber-50 text-amber-800 border-amber-200',
  moderate: 'bg-orange-50 text-orange-900 border-orange-200',
  major: 'bg-red-50 text-red-900 border-red-200',
  structural: 'bg-red-100 text-red-950 border-red-300',
};

const List: React.FC<{ items: string[]; testid: string }> = ({ items, testid }) => (
  <ul className="space-y-1" data-testid={testid}>
    {items.map((x, i) => (
      <li key={i} className="text-sm text-ink/90 leading-snug flex gap-2">
        <span className="text-muted shrink-0">•</span><span>{x}</span>
      </li>
    ))}
  </ul>
);

export const EvidenceLedgerPanel: React.FC<{ ledger?: EvidenceLedger | null }> = ({ ledger }) => {
  const { t } = useTranslation();
  if (!ledger || !ledgerHasContent(ledger)) return null;
  return (
    <section data-testid="evidence-ledger" className="p-6 bg-white border border-border-custom rounded-[32px] shadow-sm space-y-4">
      <div className="flex items-center gap-2 text-muted">
        <BookOpen className="w-4 h-4" />
        <h3 className="text-[10px] uppercase tracking-widest font-bold">{t('ledger.title')}</h3>
      </div>
      {ledger.style_note && (
        <div data-testid="ledger-style" className="p-3 rounded-2xl bg-paper border border-border-custom">
          <p className="text-[9px] uppercase tracking-widest font-bold text-muted mb-1">{t('ledger.style_note')}</p>
          <p className="text-sm text-ink">{ledger.style_note}</p>
          <p className="text-[10px] text-muted italic mt-1">{t('ledger.style_not_period')}</p>
        </div>
      )}
      {ledger.facts.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-emerald-800 flex items-center gap-1 mb-1"><Quote className="w-3 h-3" />{t('ledger.facts')}</p>
          <List items={ledger.facts} testid="ledger-facts" />
        </div>
      )}
      {ledger.claims.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-ink/70 flex items-center gap-1 mb-1"><BookOpen className="w-3 h-3" />{t('ledger.claims')}</p>
          <List items={ledger.claims} testid="ledger-claims" />
        </div>
      )}
      {ledger.photo_features.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-sky-800 flex items-center gap-1 mb-1"><Camera className="w-3 h-3" />{t('ledger.photo_features')}</p>
          <List items={ledger.photo_features} testid="ledger-photo" />
        </div>
      )}
      {ledger.hypotheses.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-violet-800 flex items-center gap-1 mb-1"><Lightbulb className="w-3 h-3" />{t('ledger.hypotheses')}</p>
          <List items={ledger.hypotheses} testid="ledger-hypotheses" />
        </div>
      )}
      {ledger.unknowns.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-amber-800 flex items-center gap-1 mb-1"><HelpCircle className="w-3 h-3" />{t('ledger.unknowns')}</p>
          <List items={ledger.unknowns} testid="ledger-unknowns" />
        </div>
      )}
      {ledger.defects.length > 0 && (
        <div>
          <p className="text-[9px] uppercase tracking-widest font-bold text-decision-red/80 flex items-center gap-1 mb-2"><AlertTriangle className="w-3 h-3" />{t('ledger.defects')}</p>
          <ul className="space-y-2" data-testid="ledger-defects">
            {ledger.defects.map((d, i) => (
              <li key={i} className={`text-sm p-2 rounded-xl border ${sevClass[d.severity]}`}>
                <span className="text-[9px] uppercase tracking-widest font-bold mr-2">{t(`ledger.severity.${d.severity}`)}</span>
                <span className="font-medium">{d.location}</span>
                <span className="mx-1">·</span>
                <span>{d.text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
};
