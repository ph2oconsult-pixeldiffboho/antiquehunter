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
      image: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 'step2',
      title: "Snap. Analyse. Decide.",
      subtext: "Instant condition reports and market demand scores at your fingertips.",
      icon: <Camera className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&q=80&w=800"
    },
    {
      id: 'step3',
      title: "Avoid costly mistakes",
      subtext: "Know exactly when to negotiate or walk away from a deal.",
      icon: <ShieldCheck className="w-12 h-12 text-gold" />,
      image: "https://images.unsplash.com/photo-1554118811-1e0d58224f24?auto=format&fit=crop&q=80&w=800"
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
                <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
                
                {/* Step 1: Price Comparison Overlay */}
                {currentStep === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="absolute top-12 left-1/2 -translate-x-1/2 w-[85%] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-6 flex flex-col gap-4 items-center shadow-2xl"
                  >
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/50 mb-1">Asking Price</p>
                      <p className="text-2xl font-light text-white/40 line-through decoration-decision-red/60 decoration-2">£1,250</p>
                    </div>
                    
                    <div className="w-8 h-px bg-white/20" />
                    
                    <div className="text-center">
                      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-gold mb-1">Real Market Value</p>
                      <p className="text-4xl font-bold text-white tracking-tight">£650 – £800</p>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Buy Score & Checklist Overlay */}
                {currentStep === 1 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="absolute inset-x-6 top-8 bg-white/10 backdrop-blur-2xl border border-white/20 rounded-[32px] p-6 shadow-2xl"
                  >
                    {/* Decision Anchor - Most Prominent */}
                    <div className="text-center mb-5 pb-5 border-b border-white/10">
                      <p className="text-[9px] uppercase tracking-[0.2em] font-bold text-gold mb-2">Expert Verdict</p>
                      <h2 className="serif text-2xl text-white leading-tight italic">“Only buy below £8,000”</h2>
                    </div>

                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/50 mb-1">Buy Score</p>
                        <p className="text-3xl font-bold text-white">84<span className="text-lg text-white/40 font-light">/100</span></p>
                      </div>
                      <div className="w-12 h-12 rounded-full border-4 border-gold/30 border-t-gold flex items-center justify-center">
                        <span className="text-[10px] font-bold text-gold">A+</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      {[
                        { label: 'Authenticity', status: 'Verified' },
                        { label: 'Condition', status: 'Excellent' },
                        { label: 'Demand', status: 'High' }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-[11px]">
                          <span className="text-white/60">{item.label}</span>
                          <span className="text-gold font-bold uppercase tracking-wider">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-20 h-20 bg-white/10 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/20 shadow-inner">
                  {steps[currentStep].icon}
                </div>
              </div>

              <div className="space-y-4 max-w-sm">
                <h1 className="serif text-4xl font-light tracking-tight leading-tight text-ink">
                  {steps[currentStep].title}
                </h1>
                <p className="text-muted text-lg font-light leading-relaxed px-4">
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
