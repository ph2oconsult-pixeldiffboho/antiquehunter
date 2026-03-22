import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { Loader2, MessageSquare, Calendar, Tag, DollarSign, AlertCircle, CheckCircle2, XCircle, HelpCircle, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface FeedbackHistoryProps {
  onBack: () => void;
  currency: string;
}

export const FeedbackHistory: React.FC<FeedbackHistoryProps> = ({ onBack, currency }) => {
  const { t, i18n } = useTranslation();
  const [feedback, setFeedback] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'analysis_feedback'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeedback(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'analysis_feedback');
    });

    return () => unsubscribe();
  }, []);

  const formatPrice = (amount: number, itemCurrency?: string) => {
    const displayCurrency = itemCurrency || currency;
    try {
      return new Intl.NumberFormat(i18n.language, {
        style: 'currency',
        currency: displayCurrency,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (e) {
      const symbols: Record<string, string> = { GBP: '£', USD: '$', EUR: '€', AUD: 'A$', JPY: '¥' };
      return `${symbols[displayCurrency] || '$'}${amount}`;
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8 pb-32">
      <header className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-3 bg-white border border-border-custom rounded-2xl text-muted hover:text-ink transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="space-y-1">
          <h1 className="serif text-3xl font-light text-ink">{t('settings.feedback_history')}</h1>
          <p className="text-[10px] uppercase tracking-widest font-bold text-muted">{t('settings.feedback_history_subtitle')}</p>
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="w-8 h-8 text-muted/40 animate-spin" />
          <p className="text-xs text-muted uppercase tracking-widest font-bold">{t('common.loading')}</p>
        </div>
      ) : feedback.length > 0 ? (
        <div className="space-y-6">
          <AnimatePresence mode="popLayout">
            {feedback.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-border-custom rounded-[32px] p-6 space-y-6 shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3 text-gold" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-muted">{item.itemCategory}</span>
                    </div>
                    <h3 className="serif text-xl text-ink">{item.itemId}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted/40">
                    <Calendar className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{formatDate(item.timestamp)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-paper rounded-2xl space-y-1">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-muted">Outcome</p>
                    <div className="flex items-center gap-2">
                      {item.userAction === 'bought' ? (
                        <CheckCircle2 className="w-4 h-4 text-decision-green" />
                      ) : item.userAction === 'not_bought' ? (
                        <XCircle className="w-4 h-4 text-decision-red" />
                      ) : (
                        <HelpCircle className="w-4 h-4 text-decision-gold" />
                      )}
                      <span className="text-sm font-medium text-ink capitalize">{item.userAction.replace('_', ' ')}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-paper rounded-2xl space-y-1">
                    <p className="text-[9px] uppercase tracking-widest font-bold text-muted">Helpful?</p>
                    <div className="flex items-center gap-2">
                      {item.isHelpful ? (
                        <CheckCircle2 className="w-4 h-4 text-decision-green" />
                      ) : (
                        <XCircle className="w-4 h-4 text-decision-red" />
                      )}
                      <span className="text-sm font-medium text-ink">{item.isHelpful ? 'Yes' : 'No'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-paper">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-widest font-bold text-muted">Predicted Range</p>
                      <p className="text-sm font-medium text-ink">
                        {formatPrice(item.predictedPriceRange.low, item.currency)} - {formatPrice(item.predictedPriceRange.high, item.currency)}
                      </p>
                    </div>
                    {item.pricePaid && (
                      <div className="space-y-1 text-right">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-decision-green">Price Paid</p>
                        <p className="text-sm font-bold text-decision-green">{formatPrice(item.pricePaid, item.currency)}</p>
                      </div>
                    )}
                    {item.notBoughtReason && (
                      <div className="space-y-1 text-right">
                        <p className="text-[9px] uppercase tracking-widest font-bold text-decision-red">Reason</p>
                        <p className="text-sm font-medium text-decision-red capitalize">{item.notBoughtReason.replace('_', ' ')}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 px-3 py-2 bg-gold/5 rounded-xl">
                    <AlertCircle className="w-3 h-3 text-gold" />
                    <p className="text-[10px] text-gold font-medium">
                      AI Confidence was {item.confidenceScore}% ({item.confidenceLevel})
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="text-center py-20 space-y-4">
          <div className="w-16 h-16 bg-paper rounded-full flex items-center justify-center mx-auto border border-border-custom">
            <MessageSquare className="w-8 h-8 text-muted/20" />
          </div>
          <div className="space-y-2">
            <p className="text-ink font-medium">No feedback yet</p>
            <p className="text-sm text-muted max-w-xs mx-auto">
              Submit feedback on your analysis results to help improve the dealer engine.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
