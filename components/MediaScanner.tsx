'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import { Camera, Video, Mic, SwitchCamera, X, Square, Circle } from 'lucide-react';
import { motion } from 'framer-motion';
import { MediaCaptureData, QuestType, MediaRequirements } from '@/types';

interface MediaScannerProps {
  questType: QuestType;
  mediaRequirements?: MediaRequirements;
  onCapture: (data: MediaCaptureData) => void;
  onCancel: () => void;
}

export default function MediaScanner({
  questType,
  mediaRequirements,
  onCapture,
  onCancel
}: MediaScannerProps) {
  const webcamRef = useRef<Webcam>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const minDuration = mediaRequirements?.minDuration || (questType === 'VIDEO' ? 5 : 10);
  const maxDuration = mediaRequirements?.maxDuration || (questType === 'VIDEO' ? 30 : 60);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingDuration(prev => {
          const newDuration = prev + 1;
          // Auto-stop at max duration
          if (newDuration >= maxDuration) {
            stopRecording();
          }
          return newDuration;
        });
      }, 1000);
    } else {
      setRecordingDuration(0);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
    // stopRecording is stable and doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, maxDuration]);

  // Capture photo
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
    chunksRef.current = [];

    try {
      let stream: MediaStream;

      if (questType === 'VIDEO') {
        // Get video + audio stream
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: true
        });
      } else {
        // Audio only
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });

        // Set up audio visualization
        audioContextRef.current = new AudioContext();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 256;
        source.connect(analyserRef.current);

        // Animation loop for audio level
        const updateAudioLevel = () => {
          if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
            setAudioLevel(average / 255);
          }
          animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        };
        updateAudioLevel();
      }

      // Determine MIME type
      const mimeType = questType === 'VIDEO'
        ? (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm')
        : (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm');

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());

        // Stop audio visualization
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }

        // Create blob and convert to base64
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result as string;
          onCapture({
            type: questType === 'VIDEO' ? 'video' : 'audio',
            data: base64Data,
            duration: recordingDuration,
            mimeType: mimeType.split(';')[0] // Remove codecs part
          });
        };
        reader.readAsDataURL(blob);
      };

      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      alert('Could not access camera/microphone. Please check permissions.');
    }
  }, [questType, facingMode, onCapture, recordingDuration]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  // Get icon based on quest type
  const getIcon = () => {
    switch (questType) {
      case 'VIDEO': return <Video className="w-5 h-5" />;
      case 'AUDIO': return <Mic className="w-5 h-5" />;
      default: return <Camera className="w-5 h-5" />;
    }
  };

  // Get status text
  const getStatusText = () => {
    if (isRecording) {
      const remaining = maxDuration - recordingDuration;
      const canStop = recordingDuration >= minDuration;
      return canStop
        ? `${recordingDuration}s (${remaining}s remaining - tap to stop)`
        : `${recordingDuration}s (min ${minDuration}s required)`;
    }

    switch (questType) {
      case 'VIDEO': return `TAP TO RECORD (${minDuration}-${maxDuration}s)`;
      case 'AUDIO': return `TAP TO RECORD (${minDuration}-${maxDuration}s)`;
      default: return 'READY TO CAPTURE';
    }
  };

  // Get accent color based on quest type
  const getAccentColor = () => {
    switch (questType) {
      case 'VIDEO': return 'text-red-500 border-red-500';
      case 'AUDIO': return 'text-purple-500 border-purple-500';
      default: return 'text-emerald-500 border-emerald-500';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Top Controls */}
      <div className="absolute top-6 left-6 right-6 z-10 flex items-center justify-between">
        <div className={`flex gap-2 bg-black/50 backdrop-blur-sm rounded-full p-1`}>
          <div className={`p-2 rounded-full ${
            questType === 'VIDEO' ? 'bg-red-500' :
            questType === 'AUDIO' ? 'bg-purple-500' :
            'bg-white'
          } ${questType === 'PHOTO' ? 'text-black' : 'text-white'}`}>
            {getIcon()}
          </div>
          {questType !== 'PHOTO' && (
            <div className="px-3 py-2 text-white text-xs font-pixel">
              {questType}
            </div>
          )}
        </div>

        <button
          onClick={onCancel}
          disabled={isRecording}
          className="p-2 bg-black/50 text-white rounded-full backdrop-blur-sm disabled:opacity-50"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Camera/Audio Preview */}
      <div className="relative flex-1 bg-black">
        {questType !== 'AUDIO' ? (
          <>
            <Webcam
              audio={questType === 'VIDEO'}
              ref={webcamRef}
              screenshotFormat="image/jpeg"
              videoConstraints={{
                facingMode: facingMode,
                width: 1920,
                height: 1080
              }}
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* HUD Overlay */}
            <div className={`absolute inset-0 border-2 ${getAccentColor().split(' ')[1]}/30 m-4 rounded-lg pointer-events-none`}>
              <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 ${getAccentColor().split(' ')[1]} rounded-tl-lg`} />
              <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 ${getAccentColor().split(' ')[1]} rounded-tr-lg`} />
              <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 ${getAccentColor().split(' ')[1]} rounded-bl-lg`} />
              <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 ${getAccentColor().split(' ')[1]} rounded-br-lg`} />

              <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${getAccentColor().split(' ')[0]}/50 text-sm animate-pulse`}>
                {getStatusText()}
              </div>
            </div>

            {/* Recording Indicator */}
            {isRecording && (
              <div className="absolute top-20 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-red-500/80 px-4 py-2 rounded-full">
                <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                <span className="text-white font-pixel text-sm">REC {recordingDuration}s</span>
              </div>
            )}
          </>
        ) : (
          // Audio-only visualization
          <div className="flex flex-col items-center justify-center h-full">
            <div className="relative">
              {/* Animated rings based on audio level */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute inset-0 rounded-full border-2 border-purple-500"
                  animate={{
                    scale: isRecording ? 1 + audioLevel * (i + 1) * 0.5 : 1,
                    opacity: isRecording ? 0.3 - i * 0.1 : 0.2
                  }}
                  transition={{ duration: 0.1 }}
                  style={{
                    width: 150 + i * 40,
                    height: 150 + i * 40,
                    left: -(i * 20),
                    top: -(i * 20)
                  }}
                />
              ))}

              <div className="w-36 h-36 rounded-full bg-purple-500/20 border-4 border-purple-500 flex items-center justify-center">
                <Mic className={`w-16 h-16 ${isRecording ? 'text-purple-400' : 'text-purple-500/50'}`} />
              </div>
            </div>

            <div className="mt-8 text-center">
              <p className={`text-lg font-pixel ${isRecording ? 'text-purple-400' : 'text-purple-500/50'}`}>
                {getStatusText()}
              </p>
              {isRecording && (
                <p className="text-sm text-gray-400 mt-2">
                  {recordingDuration >= minDuration
                    ? 'Tap stop when ready'
                    : `Wait ${minDuration - recordingDuration}s more...`}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Controls */}
      <div className="h-32 bg-black/80 backdrop-blur-md flex items-center justify-around pb-6 pt-4">
        {/* Switch Camera (only for photo/video) */}
        {questType !== 'AUDIO' ? (
          <button
            onClick={toggleCamera}
            disabled={isRecording}
            className="p-4 rounded-full bg-zinc-800 text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
        ) : (
          <div className="w-14" />
        )}

        {/* Capture/Record Button */}
        {questType === 'PHOTO' ? (
          // Photo capture button
          <button
            onClick={capturePhoto}
            className="p-1 rounded-full border-4 border-white"
          >
            <div className="w-16 h-16 bg-white rounded-full active:scale-90 transition-transform" />
          </button>
        ) : isRecording ? (
          // Stop recording button
          <button
            onClick={stopRecording}
            disabled={recordingDuration < minDuration}
            className={`p-1 rounded-full border-4 ${
              recordingDuration < minDuration
                ? 'border-gray-500 opacity-50'
                : questType === 'VIDEO'
                  ? 'border-red-500'
                  : 'border-purple-500'
            }`}
          >
            <div className={`w-16 h-16 rounded-lg flex items-center justify-center ${
              recordingDuration < minDuration
                ? 'bg-gray-500'
                : questType === 'VIDEO'
                  ? 'bg-red-500'
                  : 'bg-purple-500'
            } active:scale-90 transition-transform`}>
              <Square className="w-8 h-8 text-white" />
            </div>
          </button>
        ) : (
          // Start recording button
          <button
            onClick={startRecording}
            className={`p-1 rounded-full border-4 ${
              questType === 'VIDEO' ? 'border-red-500' : 'border-purple-500'
            }`}
          >
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              questType === 'VIDEO' ? 'bg-red-500' : 'bg-purple-500'
            } active:scale-90 transition-transform`}>
              <Circle className="w-8 h-8 text-white fill-white" />
            </div>
          </button>
        )}

        {/* Duration indicator / spacer */}
        {questType !== 'PHOTO' && isRecording ? (
          <div className="w-14 text-center">
            <span className={`text-sm font-pixel ${
              questType === 'VIDEO' ? 'text-red-400' : 'text-purple-400'
            }`}>
              {recordingDuration}s
            </span>
          </div>
        ) : (
          <div className="w-14" />
        )}
      </div>
    </motion.div>
  );
}
