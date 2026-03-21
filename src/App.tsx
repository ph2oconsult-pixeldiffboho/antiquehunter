import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { Home } from './components/Home';
import { Collection } from './components/Collection';
import { CameraCapture } from './components/CameraCapture';
import { DescriptionInput } from './components/DescriptionInput';
import { AnalysisView } from './components/AnalysisView';
import { Settings } from './components/Settings';
import { ErrorBoundary } from './components/ErrorBoundary';
import { searchAntiques } from './services/gemini';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signInWithPopup, GoogleAuthProvider, User } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Loader2, Sparkles } from 'lucide-react';

type Screen = 'home' | 'scan' | 'describe' | 'analysis' | 'collection' | 'settings' | 'upload-choice';

export default function App() {
  const { t, i18n } = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [plan, setPlan] = useState<'free' | 'pro' | 'dealer'>('free');
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetailedScan, setIsDetailedScan] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [lastDetails, setLastDetails] = useState<any>(null);
  const [isFromCollection, setIsFromCollection] = useState(false);
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

  const handleAnalyze = async (input: string, details: any, inputIsImage = false, additionalImages: string[] = []) => {
    setIsAnalyzing(true);
    setLastDetails(details);
    setIsFromCollection(false);
    
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
        details.currency,
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
      action();
    }
  };

  const confirmReset = () => {
    setAnalysisResult(null);
    setCapturedImages([]);
    setIsFromCollection(false);
    setShowResetPrompt(false);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
      </div>
    );
  }

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
            onDescribe={() => handleResetAndAction(() => {
              setIsDetailedScan(false);
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
              <div className="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto">
                <Sparkles className="w-10 h-10 text-amber-500" />
              </div>
              <h2 className="serif text-3xl font-light">{t('upload_choice.title', 'Ready to Analyze?')}</h2>
              <p className="text-zinc-500">{t('upload_choice.desc', 'Would you like to add more details for a better appraisal, or go straight to the expert analysis?')}</p>
            </div>
            
            <div className="flex flex-col gap-4">
              <button
                onClick={() => handleAnalyze(t('upload_choice.default_prompt', "Analyze this antique from the images provided."), {}, false, capturedImages)}
                className="w-full py-4 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5" />
                {t('upload_choice.analyze_now', 'Analyze Now')}
              </button>
              <button
                onClick={() => setCurrentScreen('describe')}
                className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-full font-medium hover:bg-zinc-200 transition-all"
              >
                {t('upload_choice.add_details', 'Add More Details')}
              </button>
            </div>
            
            <button 
              onClick={() => {
                setCapturedImages([]);
                setCurrentScreen('home');
              }}
              className="text-xs text-zinc-400 uppercase tracking-widest font-bold hover:text-zinc-600 transition-colors"
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
          />
        );
      case 'analysis':
        return (
          <div className="max-w-2xl mx-auto px-6 py-8">
            {isAnalyzing ? (
              <div className="flex flex-col items-center justify-center py-20 gap-6">
                <div className="relative">
                  <Loader2 className="w-12 h-12 text-amber-500 animate-spin" />
                  <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-amber-500 animate-pulse" />
                </div>
                <div className="text-center space-y-2">
                  <p className="serif text-2xl font-light">Analyzing Artifact</p>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-zinc-400">Consulting historical databases and market trends...</p>
                </div>
              </div>
            ) : (
              <AnalysisView 
                result={analysisResult} 
                images={capturedImages}
                onSave={handleSaveFind}
                onBack={() => setCurrentScreen('home')}
                onUpgrade={setPlan}
                plan={plan}
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
            plan={plan}
            onUpgrade={setPlan}
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
      <Layout onViewChange={setCurrentScreen}>
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
                  <h3 className="serif text-2xl font-light">Unsaved Analysis</h3>
                  <p className="text-sm text-zinc-500">You have an active analysis that hasn't been saved to your collection. Starting a new scan will discard it.</p>
                </div>
                <div className="flex flex-col gap-3">
                  <button 
                    onClick={() => {
                      setShowResetPrompt(false);
                      setCurrentScreen('analysis');
                    }}
                    className="w-full py-4 bg-zinc-900 text-white rounded-2xl font-bold text-sm shadow-lg shadow-zinc-900/10"
                  >
                    Go Back to Save
                  </button>
                  <button 
                    onClick={confirmReset}
                    className="w-full py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold text-sm hover:bg-zinc-200 transition-colors"
                  >
                    Discard and Continue
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </Layout>
    </ErrorBoundary>
  );
}

