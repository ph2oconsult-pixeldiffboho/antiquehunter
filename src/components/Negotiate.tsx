// "Negotiate" (dealer / shop / private) or "Bidding tips" (auction), part of "Before you buy". Figures come from the
// app's own range and walk-away (negotiation.ts); on the free plan they stay hidden like the other prices.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Handshake, Gavel, Lock } from 'lucide-react';
import type { NegotiationPlan } from '../services/negotiation';

export const Negotiate: React.FC<{ plan?: NegotiationPlan | null; currency?: string; showPrices: boolean; embedded?: boolean }> = ({ plan, currency = 'EUR', showPrices, embedded }) => {
  const { t, i18n } = useTranslation();
  if (!plan || !(plan.walk_away > 0)) return null;
  const money = (n?: number) => { if (!n) return '—'; try { return new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${Math.round(n)} ${currency}`; } };
  const price = (n?: number) => showPrices ? <span className="font-bold text-ink">{money(n)}</span> : <span className="inline-flex items-center gap-1 text-muted"><Lock className="w-3 h-3" />{t('negotiate.locked')}</span>;
  const box = embedded ? 'pt-2 space-y-3' : 'p-6 bg-white border border-border-custom rounded-[32px] space-y-4 shadow-sm';
  const invoice = (
    <p className="text-xs text-ink/80 leading-relaxed" data-testid="negotiate-invoice">
      {t('negotiate.invoice', { terms: plan.invoice.terms.map(x => t(`negotiate.invoice_terms.${x}`)).join(', ') })}
    </p>
  );
  if (plan.kind === 'auction' && plan.bidding) {
    return (
      <section data-testid="negotiate" data-kind="auction" className={box}>
        <div className="flex items-center gap-2 text-ink"><Gavel className="w-5 h-5 text-gold" /><h3 className={embedded ? 'text-sm font-bold uppercase tracking-widest' : 'serif text-2xl font-normal'}>{t('negotiate.bidding_title')}</h3></div>
        <ul className="space-y-2 text-sm text-ink/90 leading-snug list-disc pl-4">
          <li data-testid="bid-max">{t('negotiate.bid_max_prefix')} {price(plan.bidding.max_hammer)} {t('negotiate.bid_max_suffix')} {price(plan.bidding.max_all_in)} {t('negotiate.bid_max_note', { pct: plan.bidding.premium_pct })}.</li>
          <li>{t('negotiate.bid_absentee')}</li>
          <li>{t('negotiate.bid_discipline')}</li>
          <li>{t('negotiate.bid_costs')}</li>
        </ul>
        {invoice}
      </section>
    );
  }
  const p = plan.payment;
  return (
    <section data-testid="negotiate" data-kind={plan.kind} className={box}>
      <div className="flex items-center gap-2 text-ink"><Handshake className="w-5 h-5 text-gold" /><h3 className={embedded ? 'text-sm font-bold uppercase tracking-widest' : 'serif text-2xl font-normal'}>{t('negotiate.title')}</h3></div>
      <div className="grid grid-cols-2 gap-3" data-testid="negotiate-figures">
        <div className="p-3 bg-paper rounded-2xl"><p className="text-[9px] uppercase tracking-widest font-bold text-muted">{t('negotiate.opening')}</p><p className="text-lg" data-testid="negotiate-opening">{price(plan.opening_offer)}</p></div>
        <div className="p-3 bg-paper rounded-2xl"><p className="text-[9px] uppercase tracking-widest font-bold text-muted">{t('negotiate.happy_at')}</p><p className="text-lg" data-testid="negotiate-happy">{price(plan.happy_at)}</p></div>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">{t('negotiate.suggestion_note')} {showPrices && t('negotiate.walk_note', { walk: money(plan.walk_away) })}
        {showPrices && plan.asking_over_walk_pct ? ` ${t('negotiate.asking_over', { pct: plan.asking_over_walk_pct })}` : ''}</p>
      {p && (
        <div data-testid="negotiate-payment" data-mode={p.mode} className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/70 space-y-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-900">{t('negotiate.payment_title')}</p>
          {p.mode === 'transfer' ? (
            <p className="text-sm text-ink leading-snug">{t('negotiate.pay_transfer', { cap: money(p.cap_eur), capNr: money(p.cap_non_resident_eur) })}</p>
          ) : (
            <p className="text-sm text-ink leading-snug">{t(p.mode === 'cash' ? 'negotiate.pay_cash' : 'negotiate.pay_cash_private', { lo: p.discount_pct[0], hi: p.discount_pct[1], amount: showPrices && p.discount_amount ? ` (${money(p.discount_amount[0])}–${money(p.discount_amount[1])})` : '', cap: money(p.cap_eur) })}
              {p.mode === 'cash_private_receipt' && p.over_cap ? ` ${t('negotiate.pay_private_trader', { cap: money(p.cap_eur) })}` : ''}</p>
          )}
        </div>
      )}
      <ul className="space-y-2 text-sm text-ink/90 leading-snug list-disc pl-4" data-testid="negotiate-levers">
        {plan.levers.map(l => (
          <li key={l.id} data-testid={`lever-${l.id}`}>
            {l.id === 'flaws' ? t('negotiate.levers.flaws', { flaws: (l.flaws || []).map(f => t(`negotiate.flaw.${f}`, { defaultValue: f })).join('; ') }) : t(`negotiate.levers.${l.id}`)}
          </li>
        ))}
      </ul>
      {invoice}
    </section>
  );
};
