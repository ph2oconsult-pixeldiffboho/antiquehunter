import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, RefreshCw, Check, X, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface CameraCaptureProps {
  onCapture: (images: string[]) => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onCancel }) => {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImages, setCapturedImages] = useState<string[]>([]);
  const [currentPreview, setCurrentPreview] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please ensure you've granted permissions.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capture = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
        setCurrentPreview(data);
        stopCamera();
      }
    }
  };

  const handleKeep = () => {
    if (currentPreview) {
      setCapturedImages(prev => [...prev, currentPreview]);
      setCurrentPreview(null);
      startCamera();
    }
  };

  const handleRemove = (index: number) => {
    setCapturedImages(prev => prev.filter((_, i) => i !== index));
  };

  React.useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 flex items-center justify-between z-10 bg-gradient-to-b from-black/50 to-transparent">
        <button onClick={onCancel} className="p-2 text-white/80 hover:text-white transition-colors">
          <X className="w-6 h-6" />
        </button>
        <div className="text-center">
          <p className="text-[10px] uppercase tracking-widest font-bold text-white/60 mb-1">{t('describe.suggested_shots')}</p>
          <div className="flex gap-1 justify-center">
            {capturedImages.length < 4 ? (
              <span className="text-xs font-medium text-decision-amber">
                {[t('describe.shot_overall'), t('describe.shot_mark'), t('describe.shot_back'), t('describe.shot_detail')][capturedImages.length]}
              </span>
            ) : (
              <span className="text-xs font-medium text-decision-green">Ready to Analyze</span>
            )}
          </div>
        </div>
        <div className="w-10" /> {/* Spacer */}
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        {currentPreview ? (
          <img src={currentPreview} alt="Captured" className="max-w-full max-h-full object-contain" />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Captured List */}
      <div className="bg-card/90 backdrop-blur-md px-6 py-4 flex gap-3 overflow-x-auto no-scrollbar border-t border-white/5">
        {capturedImages.map((img, i) => (
          <div key={i} className="relative flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
            <img src={img} alt="" className="w-full h-full object-cover" />
            <button 
              onClick={() => handleRemove(i)}
              className="absolute top-0.5 right-0.5 p-1 bg-black/50 text-white rounded-full"
            >
              <Trash2 className="w-2 h-2" />
            </button>
          </div>
        ))}
        {capturedImages.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-muted text-[10px] uppercase tracking-widest font-bold h-16">
            No shots captured yet
          </div>
        )}
      </div>

      <div className="bg-card p-8 flex items-center justify-around">
        {currentPreview ? (
          <>
            <button
              onClick={() => {
                setCurrentPreview(null);
                startCamera();
              }}
              className="p-4 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              <RefreshCw className="w-6 h-6" />
            </button>
            <button
              onClick={handleKeep}
              className="p-6 rounded-full bg-gold text-paper hover:opacity-90 transition-colors shadow-lg shadow-gold/20"
            >
              <Plus className="w-8 h-8" />
            </button>
          </>
        ) : (
          <>
            <div className="w-14" /> {/* Spacer */}
            <button
              onClick={capture}
              className="p-6 rounded-full bg-white text-ink hover:bg-paper transition-colors shadow-xl"
            >
              <Camera className="w-8 h-8" />
            </button>
            <button
              onClick={() => capturedImages.length > 0 && onCapture(capturedImages)}
              disabled={capturedImages.length === 0}
              className="p-4 rounded-full bg-decision-green text-paper hover:opacity-90 transition-colors disabled:opacity-30 disabled:grayscale"
            >
              <Check className="w-6 h-6" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};
