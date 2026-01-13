import React from 'react';
import { X, MapPin, Image } from 'lucide-react';

interface ChatMediaPreviewProps {
  imageUrl?: string;
  location?: {
    lat: number;
    lng: number;
    name: string;
  };
  onRemoveImage?: () => void;
  onRemoveLocation?: () => void;
}

const ChatMediaPreview: React.FC<ChatMediaPreviewProps> = ({
  imageUrl,
  location,
  onRemoveImage,
  onRemoveLocation
}) => {
  if (!imageUrl && !location) return null;

  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted/50 border-t border-border">
      {imageUrl && (
        <div className="relative">
          <img
            src={imageUrl}
            alt="Preview"
            className="h-20 w-20 object-cover rounded-lg"
          />
          {onRemoveImage && (
            <button
              onClick={onRemoveImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {location && (
        <div className="relative flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <MapPin className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">Localização</p>
            <p className="text-sm text-foreground truncate max-w-[200px]">
              {location.name}
            </p>
          </div>
          {onRemoveLocation && (
            <button
              onClick={onRemoveLocation}
              className="w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatMediaPreview;
