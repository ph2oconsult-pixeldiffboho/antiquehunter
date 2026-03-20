import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { FindCard } from './FindCard';
import { Loader2, Search, Filter, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CollectionProps {
  onViewFind: (find: any) => void;
  onBack: () => void;
}

export const Collection: React.FC<CollectionProps> = ({ onViewFind, onBack }) => {
  const { t } = useTranslation();
  const [finds, setFinds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'finds'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFinds(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'finds');
    });

    return () => unsubscribe();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm(t('collection.delete_confirm'))) {
      try {
        await deleteDoc(doc(db, 'finds', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `finds/${id}`);
      }
    }
  };

  const filteredFinds = finds.filter(find => {
    const matchesSearch = find.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         find.analysis.identification.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filter === 'all' || find.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8 pb-32">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="serif text-4xl font-light tracking-tight">{t('collection.title')}</h1>
          <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-400">{finds.length} {t('common.history')}</p>
        </div>
        <button
          onClick={onBack}
          className="p-3 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300" />
          <input
            type="text"
            placeholder={t('collection.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-zinc-50 border-none rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-zinc-900/10 transition-all outline-none"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-zinc-50 border-none rounded-2xl pl-4 pr-10 py-3 text-sm appearance-none focus:ring-2 focus:ring-zinc-900/10 transition-all outline-none"
          >
            <option value="all">{t('common.view_all')}</option>
            <option value="watching">Watching</option>
            <option value="bought">Bought</option>
            <option value="passed">Passed</option>
            <option value="sold">Sold</option>
          </select>
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-300 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-zinc-300 animate-spin" />
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-bold">{t('common.loading')}</p>
        </div>
      ) : filteredFinds.length > 0 ? (
        <div className="grid grid-cols-1 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredFinds.map((find) => (
              <FindCard
                key={find.id}
                find={find}
                onClick={() => onViewFind(find)}
                onDelete={(e) => handleDelete(e, find.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 space-y-4">
          <div className="w-16 h-16 bg-zinc-50 rounded-full flex items-center justify-center mx-auto">
            <Search className="w-8 h-8 text-zinc-200" />
          </div>
          <p className="text-zinc-400 font-medium">{t('collection.empty')}</p>
        </div>
      )}
    </div>
  );
};
