import React, { useState } from 'react';
import { Building2, Fuel, Clock, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Facility } from '@/types/collaborative';
import EnhancedFacilityReviewForm from './EnhancedFacilityReviewForm';
import TruckStopReviewForm from '../poi/TruckStopReviewForm';

// Keywords to identify fuel stops / truck stops
const FUEL_STOP_KEYWORDS = [
  'pilot', 'flying j', 'loves', 'ta ', 'petro', 'town pump', 'kwik trip',
  'casey', 'bucees', 'speedway', 'shell', 'chevron', 'exxon', 'mobil', 'bp',
  'marathon', 'citgo', 'sinclair', 'conoco', 'phillips', 'gas', 'fuel', 'truck stop',
  'travel center', 'travel plaza', 'travel stop', 'rest area', 'service area', 
  'posto', 'gasolina', 'sapp', 'ambest', 'road ranger', 'quiktrip', 'wawa',
  'sheetz', 'buc-ee', 'flying', 'love\'s'
];

export type LocationType = 'facility' | 'truck_stop' | 'fuel';

export const detectLocationType = (name: string, address?: string): LocationType => {
  const searchText = `${name} ${address || ''}`.toLowerCase();
  const isFuelStop = FUEL_STOP_KEYWORDS.some(keyword => searchText.includes(keyword));
  return isFuelStop ? 'truck_stop' : 'facility';
};

interface UnifiedRatingPromptProps {
  // For facilities from geofence context
  facility?: Facility;
  // For POIs detected by name/location
  poiId?: string;
  poiName?: string;
  poiAddress?: string;
  // Type override (if already known)
  locationType?: LocationType;
  promptType: 'arrival' | 'exit';
  onComplete: () => void;
  onDismiss: () => void;
}

const UnifiedRatingPrompt: React.FC<UnifiedRatingPromptProps> = ({
  facility,
  poiId,
  poiName,
  poiAddress,
  locationType: locationTypeOverride,
  promptType,
  onComplete,
  onDismiss,
}) => {
  const [showFullForm, setShowFullForm] = useState(false);

  // Determine location name and type
  const locationName = facility?.name || poiName || 'This location';
  const locationAddress = facility?.address || poiAddress;
  const locationId = facility?.id || poiId || `poi-${Date.now()}`;
  
  // Detect location type if not provided
  const locationType = locationTypeOverride || detectLocationType(locationName, locationAddress);
  const isFuelStop = locationType === 'truck_stop' || locationType === 'fuel';

  // UI labels based on type
  const getTitle = () => {
    if (isFuelStop) {
      return promptType === 'arrival' ? 'Arrived at the stop?' : 'Leaving the stop?';
    }
    return promptType === 'arrival' ? 'Arrived at location?' : 'Leaving location?';
  };

  const getDescription = () => {
    if (isFuelStop) {
      return promptType === 'arrival' 
        ? 'Rate the facilities, cleanliness and service'
        : 'How was your experience? Your review helps other drivers.';
    }
    return promptType === 'arrival' 
      ? 'Rate this facility to help other drivers'
      : 'How was the loading/unloading? Your review helps the community.';
  };

  const getIcon = () => {
    return isFuelStop ? Fuel : Building2;
  };

  const Icon = getIcon();

  return (
    <>
      {/* Bottom Sheet Prompt */}
      {!showFullForm && (
        <div className="fixed bottom-20 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom">
          <div className="bg-card border border-border rounded-xl shadow-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold truncate max-w-[200px]">{locationName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getTitle()}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {getDescription()}
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowFullForm(true)}
                className="flex-1"
              >
                <Star className="w-4 h-4 mr-2" />
                Avaliar Agora
              </Button>
              <Button 
                variant="outline" 
                onClick={onDismiss}
                className="flex-1"
              >
                <Clock className="w-4 h-4 mr-2" />
                Depois
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Rating Form Sheet */}
      <Sheet open={showFullForm} onOpenChange={(open) => !open && setShowFullForm(false)}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon className="w-5 h-5 text-primary" />
              Avaliar {locationName}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-4">
            {isFuelStop ? (
              <TruckStopReviewForm
                poiId={locationId}
                poiName={locationName}
                poiType={locationType === 'fuel' ? 'fuel' : 'truck_stop'}
                onComplete={onComplete}
                onCancel={() => setShowFullForm(false)}
              />
            ) : facility ? (
              <EnhancedFacilityReviewForm
                facility={facility}
                onComplete={onComplete}
                onCancel={() => setShowFullForm(false)}
              />
            ) : (
              // Fallback for POI without facility object - create minimal form
              <div className="text-center text-muted-foreground py-8">
                <p>Não foi possível identificar o tipo de local.</p>
                <Button onClick={onDismiss} className="mt-4">
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default UnifiedRatingPrompt;
