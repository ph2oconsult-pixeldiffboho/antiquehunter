// Device-local copy of saved appraisals, used when the user is not signed in (or sign-in / Firestore fails).
// Images are not stored (localStorage is small); the full analysis is.
const KEY = 'ah_local_finds_v1';
const MAX = 50;

export interface LocalFind {
  id: string;
  local: true;
  title: string;
  analysis: { items: any[] };
  status: string;
  location?: string | null;
  askingPrice?: number | null;
  currency?: string | null;
  sellerType?: string | null;
  createdAt: string; // ISO
}

export const loadLocalFinds = (): LocalFind[] => {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

export const saveLocalFind = (find: Omit<LocalFind, 'id' | 'local' | 'createdAt'>): LocalFind => {
  const entry: LocalFind = { ...find, id: `local-${Date.now()}`, local: true, createdAt: new Date().toISOString() };
  const list = [entry, ...loadLocalFinds()].slice(0, MAX);
  localStorage.setItem(KEY, JSON.stringify(list)); // throws if storage is full/blocked: caller reports the error
  return entry;
};

export const deleteLocalFind = (id: string) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(loadLocalFinds().filter(f => f.id !== id)));
  } catch { /* ignore */ }
};

/** Saved finds store analysis as { items: [...] } (Firestore rules require a map); older ones stored the array/object directly. */
export const analysisItems = (analysis: any): any[] => {
  if (!analysis) return [];
  if (Array.isArray(analysis)) return analysis;
  if (Array.isArray(analysis.items)) return analysis.items;
  return [analysis];
};
