import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import MainLayout from './components/MainLayout';
import { Home } from './components/Home';
import { Collection } from './components/Collection';
import { CameraCapture } from './components/CameraCapture';
import { DescriptionInput } from './components/DescriptionInput';
import { AnalysisView } from './components/AnalysisView';
import { Profile } from './components/Profile';
import { Settings } from './components/Settings';
import { Legal } from './components/Legal';
import { Onboarding } from './components/Onboarding';
import { ErrorBoundary } from './components/ErrorBoundary';
import { searchAntiques } from './services/gemini';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Sparkles } from 'lucide-react';

type Screen = 'home' | 'scan' | 'describe' | 'analysis' | 'collection' | 'settings' | 'legal' | 'upload-choice' | 'profile';

export default function Main() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro' | 'dealer'>('free');
  const [currency, setCurrency] = useState<string>(() => {
    const saved = localStorage.getItem('user_currency');
    if (saved) return saved;
    
    try {
      const locale = navigator.language.toLowerCase();
      if (locale.includes('gb')) return 'GBP';
      if (locale.includes('us')) return 'USD';
      if (locale.includes('au')) return 'AUD';
      if (locale.includes('de') || locale.includes('fr') || locale.includes('es') || locale.includes('it')) return 'EUR';
      
      const inferred = new Intl.NumberFormat().resolvedOptions().currency;
      if (inferred && ['GBP', 'USD', 'EUR', 'AUD'].includes(inferred)) return inferred;
    } catch (e) {}
    
    return 'USD';
  });

  useEffect(() => {
    localStorage.setItem('user_currency', currency);
  }, [currency]);

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('onboarding_complete') !== 'true';
  });
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetailedScan, setIsDetailedScan] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [iterationCount, setIterationCount] = useState(0);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [lastDetails, setLastDetails] = useState<any>(null);
  const [isFromCollection, setIsFromCollection] = useState(false);
  const [autoStartListening, setAutoStartListening] = useState(false);
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
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
    "Checking market value and dealer signals...",
    "Consulting historical databases...",
    "Analyzing construction and materials...",
    "Checking for modern reproductions...",
    "Calculating investment potential...",
    "Finalizing expert appraisal..."
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

  const handleAnalyze = async (input: string, details: any, inputIsImage = false, additionalImages: string[] = []) => {
    setIsAnalyzing(true);
    setLastDetails(details);
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
      const result = await searchAntiques(
        inputIsImage ? "Analyze this antique from the images provided." : input,
        allImages.length > 0 ? allImages : undefined,
        details.askingPrice,
        details.currency || currency, // Use provided currency or fallback to global
        details.sellerType,
        i18n.language,
        details.priceType,
        details.category,
        details.location
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

  const handleSaveFind = async (status: string) => {
    if (!user) {
      await handleLogin();
      return;
    }

    if (!analysisResult) return;

    const items = Array.isArray(analysisResult) ? analysisResult : [analysisResult];
    const mainTitle = items.length > 1 
      ? `${items.length} ${t('common.items', 'Items')} Detected` 
      : items[0].item_summary.title;

    const path = 'finds';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        title: mainTitle || 'Antique Find',
        category: items[0].item_summary.category,
        images: capturedImages,
        analysis: analysisResult,
        status: status,
        location: lastDetails?.location || 'Current Location',
        notes: '',
        createdAt: serverTimestamp()
      });
      alert('Find saved to your collection!');
      setAnalysisResult(null);
      setCapturedImages([]);
      setIsFromCollection(false);
      setCurrentScreen('collection');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  };

  const handleResetAndAction = (action: () => void) => {
    if (analysisResult && !isFromCollection) {
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
    // In a real app, this would trigger a payment gateway (Stripe, etc.)
    console.log(`Initiating checkout for: ${packId}`);
    
    // For demo purposes, we'll simulate a successful purchase
    // and upgrade the user to 'pro' status
    setPlan('pro');
    alert(`Success! You've unlocked the ${packId === 'single' ? 'Single Analysis' : packId === '3pack' ? '3-Pack' : '10-Pack'}.`);
  };

  const renderScreen = () => {
    switch (currentScreen) {
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
            onAnalyze={(desc, details) => handleAnalyze(desc, details)}
            isAnalyzing={isAnalyzing}
            images={capturedImages}
            isDetailedScan={isDetailedScan}
            onAddImage={() => fileInputRef.current?.click()}
            onRemoveImage={(index) => setCapturedImages(prev => prev.filter((_, i) => i !== index))}
            autoStartListening={autoStartListening}
            currency={currency}
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
                onBack={() => setCurrentScreen('home')}
                onUpgrade={handleCheckout}
                plan={plan}
                currency={currency}
                onAddMoreDetails={() => setCurrentScreen('upload-choice')}
                iterationCount={iterationCount}
              />
            )}
          </div>
        );
      case 'collection':
        return (
          <Collection 
            onViewFind={(find) => {
              setAnalysisResult(find.analysis);
              setCapturedImages(find.images || (find.image ? [find.image] : []));
              setIsFromCollection(true);
              setCurrentScreen('analysis');
            }} 
            onBack={() => setCurrentScreen('home')}
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
      default:
        return (
          <Home 
            onScan={() => setCurrentScreen('scan')} 
            onUpload={() => fileInputRef.current?.click()}
            onDescribe={() => setCurrentScreen('describe')} 
            onViewCollection={() => setCurrentScreen('collection')}
            onViewSettings={() => setCurrentScreen('settings')}
          />
        );
    }
  };

  return (
    <ErrorBoundary>
      {showOnboarding && (
        <Onboarding onComplete={() => {
          setShowOnboarding(false);
          localStorage.setItem('onboarding_complete', 'true');
          setCurrentScreen('describe');
        }} />
      )}
      <MainLayout onViewChange={setCurrentScreen}>
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
                  <h3 className="serif text-2xl font-light text-ink">Unsaved Analysis</h3>
                  <p className="text-sm text-muted">You have an active analysis that hasn't been saved to your collection. Starting a new scan will discard it.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setShowResetPrompt(false);
                      setCurrentScreen('analysis');
                    }}
                    className="w-full py-4 bg-ink text-paper rounded-2xl font-bold text-sm shadow-lg shadow-ink/10"
                  >
                    Go Back to Save
                  </button>
                  <button 
                    onClick={confirmReset}
                    className="w-full py-4 bg-paper text-muted rounded-2xl font-bold text-sm hover:bg-border-custom transition-colors border border-border-custom"
                  >
                    Discard and Continue
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

