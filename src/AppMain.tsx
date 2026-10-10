import type { LotFacts } from "./services/lotFetch";
import type { CheckAnswers } from './services/checklist';
import type { ChecklistBase } from './services/gemini';
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import MainLayout from './components/MainLayout';
import { Home } from './components/Home';
import { FieldNotesGuide } from './components/fieldNotes/FieldNotesGuide';
import { Collection } from './components/Collection';
import { CameraCapture } from './components/CameraCapture';
import { DescriptionInput } from './components/DescriptionInput';
import { AnalysisView } from './components/AnalysisView';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';
import { Legal } from './components/Legal';
import { Onboarding } from './components/Onboarding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AntiqueHunter } from './components/AntiqueHunter';
import { IntroChoice } from './components/IntroChoice';
import { searchAntiques } from './services/gemini';
import { loadCurrency, saveCurrency } from './services/currencyPref';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Sparkles } from 'lucide-react';
import { Toast, type ToastKind, type ToastMessage } from './components/Toast';
import { analysisItems, saveLocalFind } from './services/localFinds';

const SIGNIN_TIMEOUT_MS = 60_000;      // give up on the Google popup after 1 minute
const SIGNIN_RETURN_GRACE_MS = 4_000;  // after the user comes back to the app, wait this long for the sign-in to land
const SAVE_TIMEOUT_MS = 15_000;        // Firestore write (offline writes never resolve)

const withTimeout = <T,>(p: Promise<T>, ms: number, message: string): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error(message), { code: 'timeout' })), ms);
    p.then(v => { clearTimeout(timer); resolve(v); }, e => { clearTimeout(timer); reject(e); });
  });

type Screen = 'intro-choice' | 'home' | 'scan' | 'describe' | 'analysis' | 'collection' | 'settings' | 'legal' | 'upload-choice' | 'profile' | 'hunt' | 'field-notes';

export default function Main() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro' | 'dealer'>('free');
  // One shared currency for the whole app: EUR by default; only an explicit user choice
  // (Settings, appraisal form or Find Me an Antique) is stored (see services/currencyPref.ts)
  const [currency, setCurrencyState] = useState<string>(() => loadCurrency());
  const setCurrency = (c: string) => {
    setCurrencyState(c);
    saveCurrency(c);
  };

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('onboarding_complete') !== 'true';
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
    return localStorage.getItem('onboarding_complete') === 'true' ? 'home' : 'intro-choice';
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetailedScan, setIsDetailedScan] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [iterationCount, setIterationCount] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [lastDetails, setLastDetails] = useState<any>(null);
  // "Need more evidence" re-run: the text typed last time (not the default photo prompt) and the evidence asked for
  const [lastTyped, setLastTyped] = useState('');
  const [evidenceRequest, setEvidenceRequest] = useState<any>(null);
  const [isFromCollection, setIsFromCollection] = useState(false);
  const [autoStartListening, setAutoStartListening] = useState(false);
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [fieldNotesInitial, setFieldNotesInitial] = useState<{ noteId?: string; category?: any; pieceTag?: any; periodTag?: any; query?: string } | undefined>(undefined);
  const [savedResult, setSavedResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Login error:', error);
    }
  };

  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const loadingMessages = [
    t('loading_messages.dealer_history', 'Checking dealer price history...'),
    t('loading_messages.auction_results', 'Scanning auction results...'),
    t('loading_messages.construction', 'Evaluating materials and construction...'),
    t('loading_messages.reproduction', 'Identifying reproduction risks...'),
    t('loading_messages.resale', 'Calculating resale potential...'),
    t('loading_messages.valuation', 'Finalizing valuation...')
  ];

  useEffect(() => {
    let interval: any;
    if (isAnalyzing) {
      interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 2500);
    } else {
      setLoadingMessageIndex(0);
    }
    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const readLot = async (url: string): Promise<LotFacts> => {
    try {
      const r = await fetch('/api/lot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      if (r.ok) return await r.json();
      return { ok: false, url, site: 'other', imageUrls: [], error: `status_${r.status}` };
    } catch (e: any) {
      return { ok: false, url, site: 'other', imageUrls: [], error: 'network' };
    }
  };

  const handleAnalyze = async (input: string, details: any, inputIsImage = false, additionalImages: string[] = [], checkAnswers?: CheckAnswers, previousBase?: ChecklistBase | null) => {
    setIsAnalyzing(true);
    setLastDetails(details);
    setLastTyped(inputIsImage || input === t('upload_choice.default_prompt', "Analyze this antique from the images provided.") ? '' : String(input || ''));
    setEvidenceRequest(null);
    setIsFromCollection(false);
    setIterationCount(prev => prev + 1);
    
    let allImages = [...capturedImages];
    if (inputIsImage) {
      // If input is an image, it's the primary image, and we might have additional ones
      allImages = [input, ...additionalImages];
      setCapturedImages(allImages);
    } else if (additionalImages.length > 0) {
      // If we have additional images but input is a prompt, use those
      allImages = additionalImages;
      setCapturedImages(allImages);
    }
    
    setCurrentScreen('analysis');
    
    try {
      // Fix 5: a pasted lot link is read on the server (catalogue text, estimate, fees, photos); nothing is guessed
      const lotFacts: LotFacts | null = details.lotUrl ? await readLot(details.lotUrl) : null;
      if (lotFacts?.ok && allImages.length === 0 && lotFacts.images?.length) {
        allImages = lotFacts.images;
        setCapturedImages(allImages);
      }
      const typed = inputIsImage ? "Analyze this antique from the images provided." : String(input || '').trim();
      const text = typed || (lotFacts?.ok ? [lotFacts.title, lotFacts.description].filter(Boolean).join('\n') : `Auction lot: ${details.lotUrl}`);
      const isAuctionSite = !!(lotFacts && ['drouot', 'auctionet', 'interencheres'].includes(lotFacts.site));
      const sellerType = details.sellerType || (isAuctionSite ? 'Auction' : undefined);
      // The fee published by the sale wins over the default 25% (but not over a figure the user typed)
      const premium = details.premiumTouched ? details.buyerPremiumRate : (lotFacts?.ok && lotFacts.premiumPct ? lotFacts.premiumPct : details.buyerPremiumRate);
      const result = await searchAntiques(
        text,
        allImages.length > 0 ? allImages : undefined,
        details.askingPrice,
        details.currency || currency, // Use provided currency or fallback to global
        sellerType,
        i18n.language,
        details.priceType,
        details.category,
        details.location || (lotFacts?.ok ? [lotFacts.city].filter(Boolean).join(', ') : undefined),
        details.lotUrl,
        premium,
        { lotFacts, checkAnswers, previousBase }
      );
      
      if (result) {
        setAnalysisResult(result);
      }
    } catch (error) {
      console.error('Analysis error:', error);
      setAnalysisResult({ error: "An error occurred during analysis. Please check your connection." });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newImages: string[] = [];
    let processed = 0;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        newImages.push(reader.result as string);
        processed++;
        if (processed === files.length) {
          setIsDetailedScan(false);
          setCapturedImages(prev => [...prev, ...newImages]);
          if (currentScreen !== 'describe') {
            setCurrentScreen('upload-choice');
          }
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const showToast = (kind: ToastKind, text: string) => setToast({ id: Date.now(), kind, text });

  const friendlySaveError = (err: any): string => {
    const code = String(err?.code || '');
    if (code.includes('unauthorized-domain')) return 'sign-in is not enabled for this website yet';
    if (code.includes('popup-blocked')) return 'the sign-in window was blocked';
    if (code.includes('popup-closed') || code.includes('cancelled-popup')) return 'sign-in was cancelled';
    if (code.includes('permission-denied')) return 'permission denied';
    if (code.includes('unavailable') || code.includes('network')) return 'no connection';
    return (err?.message || 'unknown error').slice(0, 120);
  };

  // Google sign-in for "Save to Log" that always settles. Firebase sometimes never rejects when the user closes the
  // popup (e.g. cross-origin popup policies), which left the button stuck on "Saving…". We resolve with null when:
  // signInWithPopup fails, the app window regains focus / becomes visible again and no user signed in within a few
  // seconds (popup closed), or after SIGNIN_TIMEOUT_MS.
  const signInOrGiveUp = (): Promise<User | null> => new Promise((resolve) => {
    let settled = false;
    let returnTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (u: User | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      if (returnTimer) clearTimeout(returnTimer);
      window.removeEventListener('focus', onReturn);
      document.removeEventListener('visibilitychange', onReturn);
      resolve(u);
    };
    const onReturn = () => {
      if (document.visibilityState === 'hidden') return;
      if (returnTimer) clearTimeout(returnTimer);
      returnTimer = setTimeout(() => finish(auth.currentUser), SIGNIN_RETURN_GRACE_MS);
    };
    const hardTimer = setTimeout(() => finish(auth.currentUser), SIGNIN_TIMEOUT_MS);
    window.addEventListener('focus', onReturn);
    document.addEventListener('visibilitychange', onReturn);
    signInWithPopup(auth, new GoogleAuthProvider())
      .then(cred => finish(cred.user))
      .catch(error => { console.error('Login error:', error?.code || error); finish(null); });
  });

  // Save the current appraisal to the user's log (Firestore when signed in, otherwise this device),
  // always with visible feedback. The Firestore document only uses fields allowed by firestore.rules (isValidFind).
  const handleSaveFind = async (status: string) => {
    if (!analysisResult) return;
    const items = analysisItems(analysisResult).filter((it: any) => it && !it.error && it.item_summary);
    if (items.length === 0) {
      showToast('error', t('toast.save_failed', { reason: 'nothing to save' }));
      return;
    }
    const mainTitle = (items.length > 1
      ? `${items.length} ${t('common.items', 'Items')} Detected`
      : items[0].item_summary?.title) || 'Antique Find';
    // JSON round-trip drops undefined values (Firestore rejects them)
    const analysis = { items: JSON.parse(JSON.stringify(items)) };
    const record = {
      title: String(mainTitle).slice(0, 250),
      analysis,
      status,
      location: lastDetails?.location ? String(lastDetails.location).slice(0, 250) : null,
      askingPrice: Number(lastDetails?.askingPrice) > 0 ? Number(lastDetails.askingPrice) : null,
      currency: String(items[0].price_guidance?.currency || lastDetails?.currency || currency).slice(0, 9),
      sellerType: lastDetails?.sellerType ? String(lastDetails.sellerType).slice(0, 63) : null,
    };

    const saveOnDevice = (reasonKey: 'saved_local' | 'save_failed_local', reason?: string) => {
      try {
        saveLocalFind(record);
        setSavedResult(analysisResult);
        showToast(reasonKey === 'saved_local' ? 'success' : 'error', t(`toast.${reasonKey}`, { reason }));
      } catch (e: any) {
        showToast('error', t('toast.save_failed', { reason: reason || friendlySaveError(e) }));
      }
    };

    let currentUser = user || auth.currentUser;
    if (!currentUser) {
      showToast('info', t('toast.signin_needed'));
      // Every sign-in outcome ends here: success, error (popup closed/blocked, unauthorized domain...), the user
      // coming back to the app without finishing (popup closed but Firebase never reports it), or a hard timeout.
      currentUser = await signInOrGiveUp();
      if (!currentUser) {
        saveOnDevice('saved_local');
        return;
      }
    }

    try {
      await withTimeout(addDoc(collection(db, 'finds'), {
        userId: currentUser.uid,
        ...record,
        notes: '',
        createdAt: serverTimestamp()
      }), SAVE_TIMEOUT_MS, 'no connection (timed out)');
      setSavedResult(analysisResult);
      showToast('success', t('toast.saved'));
    } catch (error) {
      console.error('Save to Firestore failed:', error);
      saveOnDevice('save_failed_local', friendlySaveError(error));
    }
  };

  const handleResetAndAction = (action: () => void) => {
    if (analysisResult && !isFromCollection && savedResult !== analysisResult) {
      setPendingAction(() => action);
      setShowResetPrompt(true);
    } else {
      setAnalysisResult(null);
      setCapturedImages([]);
      setIsFromCollection(false);
      setIterationCount(0);
      action();
    }
  };

  const confirmReset = () => {
    setAnalysisResult(null);
    setCapturedImages([]);
    setIsFromCollection(false);
    setIterationCount(0);
    setShowResetPrompt(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <Loader2 className="w-8 h-8 text-gold animate-spin" />
      </div>
    );
  }

  const handleCheckout = (packId: string) => {
    // Production entitlement must go through a real payment + webhook before setPlan('pro').
    // Demo / preview only: reveal numbers locally and label the badge so it is not mistaken for a paid entitlement.
    console.warn(`[demo-checkout] pack=${packId} — no payment processed; granting local demo_pro preview only`);
    setPlan('pro');
    try { sessionStorage.setItem('ah_demo_pro', '1'); } catch { /* ignore */ }
    showToast('info', t('toast.demo_unlock', 'Demo unlock — no payment was taken. Production requires a completed purchase.'));
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'intro-choice':
        return (
          <IntroChoice 
            onSelectValue={() => setCurrentScreen('home')}
            onSelectSource={() => setCurrentScreen('hunt')}
          />
        );
      case 'home':
        return (
          <Home 
            onScan={() => handleResetAndAction(() => {
              setIsDetailedScan(true);
              setCurrentScreen('scan');
            })} 
            onUpload={() => handleResetAndAction(() => {
              setIsDetailedScan(false);
              fileInputRef.current?.click();
            })}
            onDescribe={(autoListen) => handleResetAndAction(() => {
              setIsDetailedScan(false);
              setAutoStartListening(!!autoListen);
              setCurrentScreen('describe');
            })} 
            onViewCollection={() => setCurrentScreen('collection')}
            onViewSettings={() => setCurrentScreen('settings')}
            onViewHunt={() => setCurrentScreen('hunt')}
            onViewFieldNotes={(opts) => { setFieldNotesInitial(opts); setCurrentScreen('field-notes'); }}
          />
        );
      case 'scan':
        return (
          <CameraCapture 
            onCapture={(imgs) => {
              setCapturedImages(imgs);
              setCurrentScreen('upload-choice');
            }} 
            onCancel={() => setCurrentScreen('home')} 
          />
        );
      case 'upload-choice':
        return (
          <div className="max-w-2xl mx-auto px-6 py-20 space-y-8 text-center">
            <div className="space-y-4">
              <div className="w-20 h-20 bg-gold/10 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-gold" />
              </div>
              <h2 className="serif text-3xl font-light">{t('upload_choice.title', 'Ready to Analyze?')}</h2>
              <p className="text-muted">{t('upload_choice.desc', 'Would you like to add more details for a better appraisal, or go straight to the expert analysis?')}</p>
            </div>
            
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleAnalyze(t('upload_choice.default_prompt', "Analyze this antique from the images provided."), {}, false, capturedImages)}
                className="w-full py-4 bg-ink text-paper rounded-full font-medium hover:opacity-90 transition-all shadow-xl shadow-ink/20 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                {t('upload_choice.analyze_now', 'Analyze Now')}
              </button>
              <button
                onClick={() => setCurrentScreen('describe')}
                className="w-full py-4 bg-paper text-ink rounded-full font-medium hover:bg-border-custom transition-all border border-border-custom opacity-70"
              >
                {t('upload_choice.add_details', 'Add more details (optional)')}
              </button>
            </div>
            
            <button 
              onClick={() => {
                setCapturedImages([]);
                setCurrentScreen('home');
              }}
              className="text-xs text-muted uppercase tracking-widest font-bold hover:text-ink transition-colors"
            >
              {t('common.back')}
            </button>
          </div>
        );
      case 'describe':
        return (
          <DescriptionInput 
            onBack={() => {
              setCapturedImages([]);
              setCurrentScreen('home');
            }} 
            onAnalyze={(desc, details) => handleAnalyze(desc || t('upload_choice.default_prompt', "Analyze this antique from the images provided."), details)}
            isAnalyzing={isAnalyzing}
            images={capturedImages}
            initialDescription={evidenceRequest ? lastTyped : undefined}
            initialDetails={evidenceRequest ? lastDetails : undefined}
            evidenceRequest={evidenceRequest}
            isDetailedScan={isDetailedScan}
            onAddImage={() => fileInputRef.current?.click()}
            onRemoveImage={(index) => setCapturedImages(prev => prev.filter((_, i) => i !== index))}
            autoStartListening={autoStartListening}
            currency={currency}
            onCurrencyChange={setCurrency}
          />
        );
      case 'analysis':
        return (
          <div className="max-w-2xl mx-auto px-6 py-8">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-20 gap-8">
                <div className="relative">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 border-t-2 border-r-2 border-gold rounded-full"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-gold animate-pulse" />
                  </div>
                </div>
                <div className="text-center space-y-4 max-w-xs">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={loadingMessageIndex}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.4 }}
                    >
                      <p className="serif text-2xl font-light text-ink leading-tight">
                        {loadingMessages[loadingMessageIndex]}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                  <div className="space-y-2">
                    <p className="text-xs text-muted">This is where most buyers overpay — we’re checking for that.</p>
                    <div className="flex justify-center gap-1">
                      {loadingMessages.map((_, i) => (
                        <div 
                          key={i} 
                          className={`w-1 h-1 rounded-full transition-all duration-500 ${i === loadingMessageIndex ? 'bg-gold w-4' : 'bg-gold/20'}`} 
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <AnalysisView 
                result={analysisResult} 
                images={capturedImages}
                onSave={handleSaveFind}
                isSaved={isFromCollection || (!!analysisResult && savedResult === analysisResult)}
                onBack={() => setCurrentScreen('home')}
                onNewAppraisal={() => {
                  setAnalysisResult(null);
                  setCapturedImages([]);
                  setCurrentScreen('describe');
                }}
                onUpgrade={handleCheckout}
                plan={plan}
                currency={currency}
                onAddMoreDetails={() => setCurrentScreen('upload-choice')}
                onOpenFieldNotes={(opts) => { setFieldNotesInitial(opts as any); setCurrentScreen('field-notes'); }}
                onRerunWithChecks={(answers) => handleAnalyze(lastTyped || t('upload_choice.default_prompt', "Analyze this antique from the images provided."), lastDetails || {}, false, [], answers,
                  analysisItems(analysisResult)[0]?.checklist?.base || null)}
                onAddEvidence={() => {
                  // keep the photos (capturedImages) and the last inputs; the form opens pre-filled with the checklist
                  const items = analysisItems(analysisResult);
                  setEvidenceRequest(items.find((it: any) => it?.evidence_check?.required)?.evidence_check || null);
                  setCurrentScreen('describe');
                }}
                iterationCount={iterationCount}
              />
            )}
          </div>
        );
      case 'collection':
        return (
          <Collection 
            onViewFind={(find) => {
              setAnalysisResult(analysisItems(find.analysis));
              setCapturedImages(find.images || (find.image ? [find.image] : []));
              setIsFromCollection(true);
              setCurrentScreen('analysis');
            }} 
            onBack={() => setCurrentScreen('home')}
          />
        );

      case 'field-notes':
        return (
          <FieldNotesGuide
            onBack={() => { setFieldNotesInitial(undefined); setCurrentScreen('home'); }}
            initial={fieldNotesInitial}
          />
        );

      case 'settings':
        return (
          <Settings 
            onBack={() => setCurrentScreen('home')} 
            onNavigateToLegal={() => setCurrentScreen('legal')}
            plan={plan}
            onUpgrade={setPlan}
            currency={currency}
            onCurrencyChange={setCurrency}
          />
        );
      case 'legal':
        return (
          <Legal 
            onBack={() => setCurrentScreen('settings')} 
          />
        );
      case 'profile':
        return (
          <Profile 
            onBack={() => setCurrentScreen('home')} 
            plan={plan}
            onSignOut={() => auth.signOut()}
          />
        );
      case 'hunt':
        return (
          <AntiqueHunter
            onBack={() => setCurrentScreen('home')}
            currency={currency}
            onCurrencyChange={setCurrency}
          />
        );
      default:
        return (
          <Home 
            onScan={() => setCurrentScreen('scan')} 
            onUpload={() => fileInputRef.current?.click()}
            onDescribe={() => setCurrentScreen('describe')} 
            onViewCollection={() => setCurrentScreen('collection')}
            onViewSettings={() => setCurrentScreen('settings')}
            onViewHunt={() => setCurrentScreen('hunt')}
            onViewFieldNotes={(opts) => { setFieldNotesInitial(opts); setCurrentScreen('field-notes'); }}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      {showOnboarding && (
        <Onboarding
          currency={currency}
          onComplete={(next) => {
            setShowOnboarding(false);
            localStorage.setItem('onboarding_complete', 'true');
            // "Try your first item" goes straight to the appraisal form; Skip shows the home chooser
            if (next === 'appraise') {
              setIsDetailedScan(false);
              setAutoStartListening(false);
              setCurrentScreen('describe');
            } else {
              setCurrentScreen('intro-choice');
            }
          }}
        />
      )}
      <Toast toast={toast} onClose={() => setToast(null)} />
      <MainLayout onViewChange={(view) => {
        if (view === 'field-notes') setFieldNotesInitial(undefined);
        setCurrentScreen(view);
      }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          multiple
          onChange={handleFileUpload}
        />
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>

        {/* Reset Confirmation Prompt */}
        <AnimatePresence>
          {showResetPrompt && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="space-y-2 text-center">
                  <h3 className="serif text-2xl font-light text-ink">{t('reset_prompt.title', 'Unsaved Valuation')}</h3>
                  <p className="text-sm text-muted">{t('reset_prompt.desc', 'You have an active valuation that hasn\'t been logged. Starting a new check will discard this data.')}</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setShowResetPrompt(false);
                      setCurrentScreen('analysis');
                    }}
                    className="w-full py-4 bg-ink text-paper rounded-2xl font-bold text-sm shadow-lg shadow-ink/10"
                  >
                    {t('reset_prompt.back', 'Go Back to Save')}
                  </button>
                  <button 
                    onClick={confirmReset}
                    className="w-full py-4 bg-paper text-muted rounded-2xl font-bold text-sm hover:bg-border-custom transition-colors border border-border-custom"
                  >
                    {t('reset_prompt.discard', 'Discard and Continue')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </MainLayout>
    </ErrorBoundary>
  );
}

