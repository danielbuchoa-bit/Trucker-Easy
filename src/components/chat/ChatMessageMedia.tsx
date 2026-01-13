import React, { useState } from 'react';
import { MapPin, ExternalLink, X } from 'lucide-react';

interface ChatMessageMediaProps {
  imageUrl?: string | null;
  locationLat?: number | null;
  locationLng?: number | null;
  locationName?: string | null;
  isOwnMessage?: boolean;
}

const ChatMessageMedia: React.FC<ChatMessageMediaProps> = ({
  imageUrl,
  locationLat,
  locationLng,
  locationName,
  isOwnMessage
}) => {
  const [showFullImage, setShowFullImage] = useState(false);

  const hasLocation = locationLat !== null && locationLat !== undefined && 
                      locationLng !== null && locationLng !== undefined;

  const openInMaps = () => {
    if (hasLocation) {
      const url = `https://www.google.com/maps/search/?api=1&query=${locationLat},${locationLng}`;
      window.open(url, '_blank');
    }
  };

  if (!imageUrl && !hasLocation) return null;

  return (
    <div className="space-y-2 mt-1">
      {/* Image */}
      {imageUrl && (
        <>
          <img
            src={imageUrl}
            alt="Shared image"
            className="max-w-[250px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => setShowFullImage(true)}
          />

          {/* Full image modal */}
          {showFullImage && (
            <div 
              className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
              onClick={() => setShowFullImage(false)}
            >
              <button
                onClick={() => setShowFullImage(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20"
              >
                <X className="w-6 h-6" />
              </button>
              <img
                src={imageUrl}
                alt="Full image"
                className="max-w-full max-h-full object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
        </>
      )}

      {/* Location */}
      {hasLocation && (
        <button
          onClick={openInMaps}
          className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${
            isOwnMessage 
              ? 'bg-primary-foreground/10 hover:bg-primary-foreground/20' 
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            isOwnMessage ? 'bg-primary-foreground/20' : 'bg-primary/10'
          }`}>
            <MapPin className={`w-4 h-4 ${
              isOwnMessage ? 'text-primary-foreground' : 'text-primary'
            }`} />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className={`text-xs ${
              isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
            }`}>
              📍 Localização
            </p>
            <p className={`text-sm truncate max-w-[180px] ${
              isOwnMessage ? 'text-primary-foreground' : 'text-foreground'
            }`}>
              {locationName || `${locationLat?.toFixed(4)}, ${locationLng?.toFixed(4)}`}
            </p>
          </div>
          <ExternalLink className={`w-4 h-4 ${
            isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`} />
        </button>
      )}
    </div>
  );
};

export default ChatMessageMedia;
