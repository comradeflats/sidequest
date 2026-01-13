'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, SwitchCamera, X, Video, Mic, Circle, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MediaType, MediaCaptureData } from '@/types';

interface ScannerProps {
  onCapture: (data: MediaCaptureData) => void;
  onCancel: () => void;
}

export default function Scanner({ onCapture, onCancel }: ScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [selectedMode, setSelectedMode] = useState<MediaType>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingInterval, setRecordingInterval] = useState<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingInterval) clearInterval(recordingInterval);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, [recordingInterval]);

  // Photo capture
  const capturePhoto = useCallback(() => {
    const imageSrc = webcamRef.current?.getScreenshot();
    if (imageSrc) {
      onCapture({
        type: 'photo',
        data: imageSrc
      });
    }
  }, [webcamRef, onCapture]);

  // Start video/audio recording
  const startRecording = useCallback(async () => {
    try {
      let stream: MediaStream;

      if (selectedMode === 'audio') {
        // Audio only
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      } else {
        // Video (use existing webcam stream)
        const webcamStream = webcamRef.current?.stream;
        if (!webcamStream) {
          alert('Camera not ready. Please try again.');
          return;
        }

        // Get audio track separately and combine with video
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];

        stream = new MediaStream([
          ...webcamStream.getVideoTracks(),
          audioTrack
        ]);
      }

      // Create MediaRecorder
      const mimeType = selectedMode === 'audio' ? 'audio/webm' : 'video/webm';
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: selectedMode === 'video' ? 1000000 : undefined // 1 Mbps for video
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });

        // Convert blob to base64
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64data = reader.result as string;
          onCapture({
            type: selectedMode,
            data: base64data,
            duration: recordingTime
          });
        };
        reader.readAsDataURL(blob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      const interval = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = prev + 1;
          // Auto-stop at 10 seconds
          if (newTime >= 10) {
            stopRecording();
            return 10;
          }
          return newTime;
        });
      }, 1000);
      setRecordingInterval(interval);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Failed to start recording. Please check permissions.');
    }
  }, [selectedMode, onCapture]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    if (recordingInterval) {
      clearInterval(recordingInterval);
      setRecordingInterval(null);
    }

    setIsRecording(false);
  }, [recordingInterval]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleCapture = () => {
    if (selectedMode === 'photo') {
      capturePhoto();
    } else if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Top Controls - Mode Selection */}
      <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
        <div className="flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-1">
          <button
            onClick={() => setSelectedMode('photo')}
            disabled={isRecording}
            className={`p-2 rounded-full transition-colors ${
              selectedMode === 'photo'
                ? 'bg-white text-black'
                : 'text-white hover:bg-white/20'
            } disabled:opacity-50`}
            title="Photo mode"
          >
            <Camera className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedMode('video')}
            disabled={isRecording}
            className={`p-2 rounded-full transition-colors ${
              selectedMode === 'video'
                ? 'bg-white text-black'
                : 'text-white hover:bg-white/20'
            } disabled:opacity-50`}
            title="Video mode"
          >
            <Video className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedMode('audio')}
            disabled={isRecording}
            className={`p-2 rounded-full transition-colors ${
              selectedMode === 'audio'
                ? 'bg-white text-black'
                : 'text-white hover:bg-white/20'
            } disabled:opacity-50`}
            title="Audio mode"
          >
            <Mic className="w-5 h-5" />
          </button>
        </div>

        <button
          onClick={onCancel}
          disabled={isRecording}
          className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera Preview / Audio Visualization */}
      <div className="relative flex-1 bg-black">
        {selectedMode === 'audio' ? (
          // Audio recording visualization
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Mic className={`w-32 h-32 mx-auto mb-6 ${
                isRecording ? 'text-red-500 animate-pulse' : 'text-emerald-500'
              }`} />
              <p className="text-white text-2xl font-pixel">
                {isRecording ? 'RECORDING...' : 'AUDIO MODE'}
              </p>
              {isRecording && (
                <p className="text-emerald-500 text-xl font-pixel mt-4">
                  {recordingTime}/10s
                </p>
              )}
              {!isRecording && (
                <p className="text-emerald-500/50 text-sm mt-4">
                  Record ambient sounds or describe the location
                </p>
              )}
            </div>
          </div>
        ) : (
          <>
            <Webcam
              audio={false}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: facingMode,
                width: selectedMode === 'video' ? 1280 : 1920,
                height: selectedMode === 'video' ? 720 : 1080
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Recording indicator for video */}
            {selectedMode === 'video' && isRecording && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-full flex items-center gap-2 z-10">
                <Circle className="w-4 h-4 fill-white animate-pulse" />
                <span className="font-pixel text-sm">{recordingTime}/10s</span>
              </div>
            )}

            {/* HUD Overlay */}
            <div className="absolute inset-0 border-2 border-emerald-500/30 m-4 rounded-lg pointer-events-none">
              <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg" />

              {!isRecording && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500/50 text-sm animate-pulse">
                  {selectedMode === 'photo' ? 'READY TO CAPTURE' : 'READY TO RECORD'}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="h-32 bg-black/80 backdrop-blur-md flex items-center justify-around pb-6 pt-4">
        {selectedMode !== 'audio' && (
          <button
            onClick={toggleCamera}
            disabled={isRecording}
            className="p-4 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
        )}

        {/* Capture/Record Button */}
        <button
          onClick={handleCapture}
          className={`p-1 rounded-full border-4 ${
            isRecording ? 'border-red-500' : 'border-white'
          }`}
        >
          {isRecording ? (
            <div className="w-12 h-12 bg-red-500 rounded transition-all" />
          ) : selectedMode === 'photo' ? (
            <div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform" />
          ) : (
            <Circle className="w-16 h-16 text-red-500 fill-red-500 active:scale-90 transition-transform" />
          )}
        </button>

        {selectedMode !== 'audio' && <div className="w-14" />}
      </div>
    </motion.div>
  );
}
