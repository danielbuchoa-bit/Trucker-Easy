import React, { useState } from 'react';
import { Building2, Clock, Star, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { Facility } from '@/types/collaborative';
import EnhancedFacilityReviewForm from './EnhancedFacilityReviewForm';

interface FacilityRatingPromptProps {
  facility: Facility;
  promptType: 'arrival' | 'exit';
  onComplete: () => void;
  onDismiss: () => void;
}

const FacilityRatingPrompt: React.FC<FacilityRatingPromptProps> = ({
  facility,
  promptType,
  onComplete,
  onDismiss,
}) => {
  const [showFullForm, setShowFullForm] = useState(false);

  return (
    <>
      {/* Bottom Sheet Prompt */}
      {!showFullForm && (
        <div className="fixed bottom-20 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom">
          <div className="bg-card border border-border rounded-xl shadow-lg p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">{facility.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {promptType === 'arrival' ? 'Just arrived?' : 'Leaving now?'}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onDismiss}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <p className="text-sm text-muted-foreground mb-3">
              {promptType === 'arrival' 
                ? 'Rate this facility to help other drivers'
                : 'How was your experience? Your review helps the community.'}
            </p>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowFullForm(true)}
                className="flex-1"
              >
                <Star className="w-4 h-4 mr-2" />
                Rate Now
              </Button>
              <Button 
                variant="outline" 
                onClick={onDismiss}
                className="flex-1"
              >
                <Clock className="w-4 h-4 mr-2" />
                Later
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full Rating Form Sheet */}
      <Sheet open={showFullForm} onOpenChange={(open) => !open && setShowFullForm(false)}>
        <SheetContent side="bottom" className="h-[90vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              Rate {facility.name}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-4">
            <EnhancedFacilityReviewForm
              facility={facility}
              onComplete={onComplete}
              onCancel={() => setShowFullForm(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

export default FacilityRatingPrompt;
