// Maker attribution (stamped / attributed / dealer's label) and the verified auction comparables behind the range.
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Gavel, ExternalLink, ShieldAlert } from 'lucide-react';
import type { Comparable } from '../services/compsMath';

export const MakerAndComparables: React.FC<{ item: any }> = ({ item }) => {
  const { t, i18n } = useTranslation();
  const maker = item?.maker_attribution;
  const comps = item?.comparables;
  if (!maker) return null;
  const list: Comparable[] = comps?.list || [];
  const used = new Set<string>(comps?.used_urls || []);
  const money = (n: number, cur = 'EUR') => { try { return new Intl.NumberFormat(i18n.language || 'en', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(Math.round(n)); } catch { return `${Math.round(n)} ${cur}`; } };
  const date = (d?: string) => { if (!d) return '—'; const x = new Date(d.length === 4 ? `${d}-01-01` : d); return isNaN(x.getTime()) ? d : d.length === 4 ? d : x.toLocaleDateString(i18n.language || 'en', { year: 'numeric', month: 'short', day: 'numeric' }); };
  return (
    <section data-testid="comparables" className="p-6 bg-white border border-border-custom rounded-[32px] space-y-4 shadow-sm">
      <div className="flex items-center gap-2"><Gavel className="w-5 h-5 text-gold" /><h3 className="serif text-2xl font-normal">{t('comps.title')}</h3></div>
      <div data-testid="maker-status" className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-ink">{maker.name}</span>
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${(['stamped_confirmed','stamped_stated','stamp_in_photo'].includes(maker.status) ? 'bg-emerald-100 text-emerald-800' : maker.status === 'attributed' ? 'bg-amber-100 text-amber-800' : maker.status === 'doubtful_stamp' ? 'bg-orange-100 text-orange-900' : 'bg-red-50 text-red-700')}`}>{t(`comps.status.${maker.status}`)}</span>
      </div>
      <p className="text-xs text-muted">{t(`comps.status_note.${maker.status}`)}</p>
      {maker.jme && <p className="text-[11px] text-muted" data-testid="jme-mention">{t('comps.jme_note')}</p>}
      {['stamped_confirmed', 'stamped_stated', 'stamp_in_photo'].includes(maker.status) && (
        <div data-testid="stamp-warning" className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl">
          <ShieldAlert className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
          <p className="text-xs text-ink leading-relaxed">{t('comps.stamp_warning', { maker: maker.name })}</p>
        </div>
      )}
      {comps?.status === 'anchored' && (
        <p className="text-sm text-ink" data-testid="comps-anchor">{t(comps.basis === 'hammer' ? 'comps.anchored_hammer' : 'comps.anchored_all_in', { n: (comps.used_urls || []).length, median: money(comps.per_piece_median_eur), pieces: comps.pieces })}</p>
      )}
      {comps?.status !== 'anchored' && <p className="text-sm text-ink" data-testid="comps-fallback">{t(`comps.fallback.${comps?.status === 'shown' ? (comps.reason || 'too_few') : comps?.status || 'not_searched'}`, { maker: maker.name })}</p>}
      {list.length > 0 && maker.status !== 'doubtful_stamp' && (
        <ul className="space-y-3">
          {list.map(c => (
            <li key={c.url} className={`p-3 rounded-2xl border ${used.has(c.url) ? 'border-gold/50 bg-gold/5' : 'border-border-custom'}`}>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-sm text-ink font-medium hover:underline inline-flex items-start gap-1">{c.title}<ExternalLink className="w-3 h-3 mt-1 shrink-0" /></a>
              <p className="text-[11px] text-muted mt-1">{c.house} · {date(c.date)} · {t('comps.pieces', { count: c.pieces })} · {t(`comps.stamp.${c.stamp}`)}{c.material ? ` · ${t(`comps.material.${c.material}`, c.material)}` : ''}</p>
              <p className="text-xs text-ink mt-1">{money(c.price, c.currency)} {t(c.feesIncluded ? 'comps.with_fees' : 'comps.hammer')} · <span className="font-bold">{money(c.perPieceAllInEur)} {t('comps.per_piece_all_in')}</span>{!used.has(c.url) && comps?.status === 'anchored' ? ` · ${t('comps.not_used')}` : ''}</p>
            </li>
          ))}
        </ul>
      )}
      {(comps?.nearest || []).length > 0 && (
        <div data-testid="comps-nearest" className="space-y-1 pt-1">
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('comps.nearest_title', 'Nearest lots — why kept or dropped')}</p>
          <ul className="space-y-1">
            {(comps.nearest as Array<{ url: string; title: string; kept: boolean; reason: string; perPieceEur: number }>).slice(0, 8).map((n) => (
              <li key={n.url + n.reason} className="text-[10px] text-muted leading-snug">
                <span className={n.kept ? 'text-emerald-700 font-bold' : 'text-amber-800 font-bold'}>{n.kept ? t('comps.kept', 'Kept') : t('comps.dropped', 'Dropped')}</span>
                {' · '}{n.reason.replace(/_/g, ' ')}
                {' · '}{(n.title || '').slice(0, 80)}
                {n.perPieceEur ? ` · ~€${Math.round(n.perPieceEur).toLocaleString()}/pc` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {(comps?.unreachable || []).length > 0 && <p className="text-[10px] text-muted">{t('comps.unreachable', { list: comps.unreachable.join(', ') })}</p>}
      <p className="text-[10px] text-muted">{t('comps.verified_note')}</p>
    </section>
  );
};
