import React, { useState } from 'react';
import { MapPin, Navigation, Star, ThumbsUp, ThumbsDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

interface DestinationArrivalPromptProps {
  destinationName: string;
  destinationAddress?: string;
  onConfirmArrival: (wasEasyToFind: boolean | null) => void;
  onDismiss: () => void;
}

const DestinationArrivalPrompt: React.FC<DestinationArrivalPromptProps> = ({
  destinationName,
  destinationAddress,
  onConfirmArrival,
  onDismiss,
}) => {
  const [showEasyQuestion, setShowEasyQuestion] = useState(false);

  const handleArrived = () => {
    setShowEasyQuestion(true);
  };

  const handleEasyResponse = (wasEasy: boolean) => {
    onConfirmArrival(wasEasy);
  };

  const handleSkip = () => {
    onConfirmArrival(null);
  };

  return (
    <Sheet open={true} onOpenChange={() => onDismiss()}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2 text-lg">
              <Navigation className="h-5 w-5 text-primary" />
              Chegou ao destino?
            </SheetTitle>
            <Button variant="ghost" size="icon" onClick={onDismiss}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </SheetHeader>

        <div className="space-y-4 pb-4">
          {/* Destination info */}
          <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-base truncate">{destinationName}</h3>
              {destinationAddress && (
                <p className="text-sm text-muted-foreground truncate">{destinationAddress}</p>
              )}
            </div>
          </div>

          {!showEasyQuestion ? (
            <>
              <p className="text-sm text-muted-foreground text-center">
                Você chegou ao seu destino?
              </p>
              
              <div className="flex gap-3">
                <Button 
                  variant="default" 
                  onClick={handleArrived}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Sim, cheguei!
                </Button>
                <Button 
                  variant="outline" 
                  onClick={onDismiss}
                  className="flex-1"
                >
                  Ainda não
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-center font-medium">
                Foi fácil encontrar este local?
              </p>
              
              <div className="flex gap-3">
                <Button 
                  variant="default" 
                  onClick={() => handleEasyResponse(true)}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Sim, fácil
                </Button>
                <Button 
                  variant="default" 
                  onClick={() => handleEasyResponse(false)}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Difícil
                </Button>
              </div>
              
              <Button 
                variant="ghost" 
                onClick={handleSkip}
                className="w-full text-muted-foreground"
              >
                Pular
              </Button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default DestinationArrivalPrompt;
