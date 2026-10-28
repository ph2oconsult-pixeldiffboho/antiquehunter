// Offer plan shown when the price is above fair value or the walk-away (motivation.ts computes every figure).
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handshake, Lock } from 'lucide-react';
import type { MotivationDecision } from '../services/motivation';

export const OfferPlan: React.FC<{ md?: MotivationDecision | null; currency?: string; showPrices: boolean }> = ({ md, currency = 'EUR', showPrices }) => {
  const { t, i18n } = useTranslation();
  const p = md?.plan;
  if (!md || !p) return null;
  const m = (n?: number | null) => { if (!n) return '—'; try { return new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${Math.round(n)} ${currency}`; } };
  if (!showPrices) return (
    <section data-testid="offer-plan" className="p-6 bg-white border border-border-custom rounded-[32px] space-y-2 shadow-sm">
      <h3 className="serif text-2xl font-normal">{t('offer.title')}</h3>
      <p className="text-sm text-muted inline-flex items-center gap-1"><Lock className="w-3 h-3" />{t('negotiate.locked')}</p>
    </section>
  );
  const items: string[] = [];
  if (p.venue === 'auction') {
    items.push(t('offer.max_bid', { hammer: m(p.max_hammer), allIn: m(p.max_all_in), pct: p.premium_pct }));
  } else {
    items.push(t('offer.opening', { amount: m(p.opening_offer) }));
    if (p.cash_price) items.push(t(`offer.cash_${p.venue}`, { amount: m(p.cash_price) }));
    else if (p.cash_capped) items.push(t('offer.cash_capped'));
    items.push(t('offer.best_final', { amount: m(p.best_and_final) }));
  }
  if (p.over_walk_away) {
    items.push(t('offer.stretch', { amount: m(p.over_walk_away), walkAway: m(md.walkAway), pct: p.premium_cap_pct, budget: m(md.budget) }));
    items.push(t(p.venue === 'auction' ? 'offer.never_above_max_auction' : 'offer.never_above_max', { max: m(p.venue === 'auction' ? p.max_hammer : p.best_and_final) }));
  } else items.push(t(p.venue === 'auction' ? 'offer.never_above_auction' : 'offer.never_above', { walkAway: m(md.walkAway) }));
  if (md.budget) items.push(md.overBudget ? t('offer.budget_over', { budget: m(md.budget), gap: m(md.budgetGap) }) : t('offer.budget_ok', { budget: m(md.budget) }));
  return (
    <section data-testid="offer-plan" data-venue={p.venue} className="p-6 bg-white border border-border-custom rounded-[32px] space-y-4 shadow-sm">
      <div className="flex items-center gap-2 text-ink"><Handshake className="w-5 h-5 text-gold" /><h3 className="serif text-2xl font-normal">{t('offer.title')}</h3></div>
      <ul className="space-y-2 text-sm text-ink/90 leading-snug list-disc pl-4">{items.map((x, i) => <li key={i}>{x}</li>)}</ul>
    </section>
  );
};
