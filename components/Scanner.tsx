'use client';

import { useRef, useCallback, useState } from 'react';
import Webcam from 'react-webcam';
import { Camera, SwitchCamera, X } from 'lucide-react';
import { motion } from 'framer-motion';

interface ScannerProps {
  onCapture: (imageSrc: string) => void;
  onCancel: () => void;
}

export default function Scanner({ onCapture, onCancel }: ScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');

  const capture = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture(imageSrc);
    }
  }, [webcamRef, onCapture]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      <div className="relative flex-1 bg-black">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          videoConstraints={{
            facingMode: facingMode
          }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* HUD Overlay */}
        <div className="absolute inset-0 border-2 border-emerald-500/30 m-4 rounded-lg pointer-events-none">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500/50 text-sm animate-pulse">
            SCANNING...
          </div>
        </div>

        {/* Top Controls */}
        <div className="absolute top-6 right-6 z-10">
          <button 
            onClick={onCancel}
            className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-32 bg-black/80 backdrop-blur-md flex items-center justify-around pb-6 pt-4">
        <button 
          onClick={toggleCamera}
          className="p-4 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors"
        >
          <SwitchCamera className="w-6 h-6" />
        </button>

        <button 
          onClick={capture}
          className="p-1 rounded-full border-4 border-white"
        >
          <div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform" />
        </button>

        <div className="w-14" /> {/* Spacer for symmetry */}
      </div>
    </motion.div>
  );
}
