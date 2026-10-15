// Admin-only tools for the shared range store: the token lives in this browser only (localStorage), never in the repo.
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export const ADMIN_TOKEN_KEY = 'ah_range_admin_token';
const readToken = () => { try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch { return ''; } };

/** Settings: enter or remove the admin token. */
export const RangeAdminToken: React.FC = () => {
  const { t } = useTranslation();
  const [val, setVal] = useState(readToken());
  const [saved, setSaved] = useState(!!readToken());
  const [flash, setFlash] = useState(false);
  return (
    <div className="space-y-2" data-testid="range-admin-token">
      <label className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('range_admin.token_label')}</label>
      <input type="password" autoComplete="off" value={val} onChange={(e) => setVal(e.target.value)} className="w-full p-3 bg-paper border border-border-custom rounded-xl text-sm" />
      <div className="flex gap-2">
        <button className="px-4 py-2 text-xs bg-ink text-paper rounded-full" onClick={() => { try { if (val.trim()) localStorage.setItem(ADMIN_TOKEN_KEY, val.trim()); else localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ } setSaved(!!val.trim()); setFlash(true); }}>{t('range_admin.save')}</button>
        {saved && <button className="px-4 py-2 text-xs border border-border-custom rounded-full" onClick={() => { try { localStorage.removeItem(ADMIN_TOKEN_KEY); } catch { /* ignore */ } setVal(''); setSaved(false); }}>{t('range_admin.remove')}</button>}
      </div>
      {flash && <p className="text-[11px] text-muted" role="status">{saved ? t('range_admin.saved') : t('range_admin.removed')}</p>}
      {saved && !flash && <p className="text-[11px] text-muted">{t('range_admin.active')}</p>}
    </div>
  );
};

/** Result page: "Reset saved price range", only when an admin token is set and the appraisal has a piece key. */
export const ResetRangeButton: React.FC<{ pieceKey?: string }> = ({ pieceKey }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const token = readToken();
  if (!token) return null;
  // Older appraisals, lot links and checklist re-runs have no shared range: say so instead of showing nothing
  if (!pieceKey) return <p data-testid="reset-range-unavailable" className="text-center text-[11px] text-muted">{t('range_admin.no_key')}</p>;
  const run = async () => {
    setState('busy');
    try {
      const r = await fetch('/api/range-store/clear', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ piece_key: pieceKey }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };
  return (
    <div className="text-center space-y-1" data-testid="reset-range">
      <button disabled={state === 'busy'} onClick={run} className="px-4 py-2 text-xs border border-decision-red/40 text-decision-red rounded-full">{t('range_admin.reset')}</button>
      {state === 'done' && <p className="text-[11px] text-muted">{t('range_admin.done')}</p>}
      {state === 'error' && <p className="text-[11px] text-decision-red">{t('range_admin.error')}</p>}
      <p className="text-[10px] text-muted">{pieceKey}</p>
    </div>
  );
};
