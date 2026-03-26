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
          <h1 className="serif text-4xl font-light tracking-tight text-ink">{t('collection.title')}</h1>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted">{finds.length} {t('common.history')}</p>
        </div>
        <button
          onClick={onBack}
          className="p-3 rounded-full bg-paper text-muted hover:bg-border-custom transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40" />
          <input
            type="text"
            placeholder={t('collection.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-paper border-none rounded-2xl pl-12 pr-4 py-3 text-sm focus:ring-2 focus:ring-gold/10 transition-all outline-none text-ink placeholder:text-muted/40"
          />
        </div>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-paper border-none rounded-2xl pl-4 pr-10 py-3 text-sm appearance-none focus:ring-2 focus:ring-gold/10 transition-all outline-none text-ink"
          >
            <option value="all">{t('common.view_all')}</option>
            <option value="watching">{t('common.status_watching')}</option>
            <option value="bought">{t('common.status_bought')}</option>
            <option value="passed">{t('common.status_passed')}</option>
            <option value="sold">{t('common.status_sold')}</option>
          </select>
          <Filter className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted/40 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-muted/40 animate-spin" />
          <p className="text-xs text-muted uppercase tracking-widest font-bold">{t('common.loading')}</p>
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
          <div className="w-16 h-16 bg-paper rounded-full flex items-center justify-center mx-auto border border-border-custom">
            <Search className="w-8 h-8 text-muted/20" />
          </div>
          <p className="text-muted font-medium">{t('collection.empty')}</p>
        </div>
      )}
    </div>
  );
};
