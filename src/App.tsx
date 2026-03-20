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
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isDetailedScan, setIsDetailedScan] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [lastDetails, setLastDetails] = useState<any>(null);
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

  const handleAnalyze = async (input: string, details: any, isImage = false, additionalImages: string[] = []) => {
    setIsAnalyzing(true);
    setLastDetails(details);
    
    let allImages = [...capturedImages];
    if (isImage) {
      allImages = [input, ...additionalImages];
      setCapturedImages(allImages);
    }
    
    setCurrentScreen('analysis');
    
    try {
      const result = await searchAntiques(
        isImage ? "Analyze this antique from the images provided." : input,
        allImages.length > 0 ? allImages : undefined,
        details.askingPrice,
        details.currency,
        details.sellerType,
        i18n.language
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
      : items[0].identification;

    const path = 'finds';
    try {
      await addDoc(collection(db, path), {
        userId: user.uid,
        title: mainTitle || 'Antique Find',
        images: capturedImages,
        analysis: analysisResult,
        status: status,
        location: 'Current Location', // Placeholder
        notes: '',
        createdAt: serverTimestamp()
      });
      alert('Find saved to your collection!');
      setCurrentScreen('collection');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
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
            onScan={() => {
              setIsDetailedScan(true);
              setCurrentScreen('scan');
            }} 
            onUpload={() => {
              setIsDetailedScan(false);
              fileInputRef.current?.click();
            }}
            onDescribe={() => {
              setIsDetailedScan(false);
              setCurrentScreen('describe');
            }} 
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
                onClick={() => handleAnalyze("Analyze this antique from the images provided.", {}, isDetailedScan, capturedImages)}
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
              setCurrentScreen('analysis');
            }} 
            onBack={() => setCurrentScreen('home')}
          />
        );
      case 'settings':
        return (
          <Settings onBack={() => setCurrentScreen('home')} />
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
      </Layout>
    </ErrorBoundary>
  );
}

