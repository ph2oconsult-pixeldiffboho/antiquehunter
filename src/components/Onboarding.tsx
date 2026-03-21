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
      image: "https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 'step2',
      title: "Snap. Analyse. Decide.",
      subtext: "Upload a photo or describe the item. Get pricing, risks, and negotiation strategy.",
      icon: <Camera className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 'step3',
      title: "Avoid costly mistakes",
      subtext: "Know when to buy, negotiate, or walk away",
      icon: <ShieldCheck className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1573164713988-8665fc963095?auto=format&fit=crop&q=80&w=800"
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
                
                {/* Value Comparison Overlay for Step 1 */}
                {currentStep === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    className="absolute top-8 left-1/2 -translate-x-1/2 w-[80%] bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-4 flex flex-col gap-1 items-center"
                  >
                    <p className="text-[9px] uppercase tracking-widest font-bold text-white/60">Asking Price</p>
                    <p className="text-xl font-medium text-white/40 line-through decoration-decision-red decoration-2">£950</p>
                    <div className="w-px h-4 bg-white/20 my-1" />
                    <p className="text-[9px] uppercase tracking-widest font-bold text-decision-gold">Real Market Value</p>
                    <p className="text-2xl font-bold text-white tracking-tight">£450 – £600</p>
                  </motion.div>
                )}

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
