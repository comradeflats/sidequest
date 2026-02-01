'use client';

import { LocationResearch } from '@/types';
import { X, MapPin, Building, Users, Camera, Info } from 'lucide-react';

interface LocationInfoModalProps {
  locationResearch: LocationResearch | null;
  isOpen: boolean;
  onClose: () => void;
}

export default function LocationInfoModal({
  locationResearch,
  isOpen,
  onClose
}: LocationInfoModalProps) {
  if (!isOpen || !locationResearch) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="bg-zinc-900 border-2 border-adventure-gold rounded-lg max-w-md w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-zinc-900 border-b-2 border-adventure-gold p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-adventure-gold" />
            <h2 className="text-xl font-pixel text-adventure-gold" style={{ fontSize: '1rem' }}>
              LOCATION INFO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Place Name */}
          <div>
            <h3 className="text-lg font-pixel text-adventure-emerald mb-2">
              {locationResearch.placeName}
            </h3>
          </div>

          {/* Historical Significance */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-adventure-sky" />
              <h4 className="text-xs uppercase text-adventure-sky font-pixel">
                Historical Significance
              </h4>
            </div>
            <p className="text-sm font-sans text-gray-300 leading-relaxed">
              {locationResearch.historicalSignificance}
            </p>
          </div>

          {/* Visitor Tips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-adventure-gold" />
              <h4 className="text-xs uppercase text-adventure-gold font-pixel">
                Visitor Tips
              </h4>
            </div>
            <p className="text-sm font-sans text-gray-300 leading-relaxed">
              {locationResearch.visitorTips}
            </p>
          </div>

          {/* Cultural Context */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-adventure-emerald" />
              <h4 className="text-xs uppercase text-adventure-emerald font-pixel">
                Cultural Context
              </h4>
            </div>
            <p className="text-sm font-sans text-gray-300 leading-relaxed">
              {locationResearch.culturalContext}
            </p>
          </div>

          {/* Media Tips */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs uppercase text-purple-400 font-pixel">
                Photography Tips
              </h4>
            </div>
            <p className="text-sm font-sans text-gray-300 leading-relaxed">
              {locationResearch.mediaTips}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t-2 border-adventure-brown p-6">
          <button
            onClick={onClose}
            className="w-full bg-adventure-emerald text-black font-bold font-pixel py-3 px-6 rounded-lg hover:bg-adventure-gold transition-colors"
            style={{ fontSize: '0.85rem' }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
