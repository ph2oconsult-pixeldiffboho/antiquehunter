import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, Sparkles, Camera, ShieldCheck } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      id: 'step1',
      title: "Don’t overpay for antiques",
      subtext: "Get dealer-level insight before you buy",
      icon: <Sparkles className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 'step2',
      title: "Snap. Analyse. Decide.",
      subtext: "Upload a photo or describe the item. Get pricing, risks, and negotiation strategy.",
      icon: <Camera className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1531058020387-3be344556be6?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 'step3',
      title: "Avoid costly mistakes",
      subtext: "Know when to buy, negotiate, or walk away",
      icon: <ShieldCheck className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800"
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div className="fixed inset-0 bg-paper z-[100] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <div className="p-6 flex items-center justify-between z-10">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div 
              key={i}
              className={`h-1 rounded-full transition-all duration-500 ${
                i === currentStep ? 'w-8 bg-gold' : 'w-2 bg-border-custom'
              }`}
            />
          ))}
        </div>
        <button 
          onClick={onComplete}
          className="text-[10px] uppercase tracking-widest font-bold text-muted hover:text-ink transition-colors"
        >
          Skip
        </button>
      </div>

      <div className="flex-1 relative">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            <div className="flex-1 px-6 flex flex-col items-center justify-center text-center space-y-12">
              <div className="relative w-full aspect-[4/5] max-h-[400px] rounded-[44px] overflow-hidden shadow-2xl shadow-ink/10">
                <img 
                  src={steps[currentStep].image} 
                  alt="" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/40 to-transparent" />
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20">
                  {steps[currentStep].icon}
                </div>
              </div>

              <div className="space-y-4 max-w-sm">
                <h1 className="serif text-4xl font-light tracking-tight leading-tight text-ink">
                  {steps[currentStep].title}
                </h1>
                <p className="text-muted text-lg font-light leading-relaxed">
                  {steps[currentStep].subtext}
                </p>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Action */}
      <div className="p-8">
        <button
          onClick={handleNext}
          className="w-full py-5 bg-ink text-paper rounded-full font-bold text-lg shadow-xl shadow-ink/20 flex items-center justify-center gap-3 group transition-all active:scale-[0.98]"
        >
          <span>{currentStep === steps.length - 1 ? "Try your first item" : "Continue"}</span>
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};
