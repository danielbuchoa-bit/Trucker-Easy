import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Loader2, Volume2 } from 'lucide-react';
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface VoiceAssistantButtonProps {
  className?: string;
  size?: 'default' | 'sm' | 'lg' | 'icon';
  onCommand?: (command: {
    action: string;
    parameters: Record<string, unknown>;
  }) => void;
}

export function VoiceAssistantButton({ 
  className, 
  size = 'icon',
  onCommand 
}: VoiceAssistantButtonProps) {
  const navigate = useNavigate();
  const {
    isSupported,
    isListening,
    isProcessing,
    transcript,
    lastCommand,
    startListening,
    stopListening,
    speak,
  } = useVoiceAssistant();

  useEffect(() => {
    if (lastCommand && lastCommand.confidence > 0.5) {
      handleCommand(lastCommand);
    }
  }, [lastCommand]);

  const handleCommand = (command: {
    action: string;
    parameters: Record<string, unknown>;
    confirmation: string;
  }) => {
    if (onCommand) {
      onCommand(command);
      return;
    }

    // Default command handling
    switch (command.action) {
      case 'navigate':
        const destination = command.parameters.destination as string;
        if (destination) {
          navigate(`/navigation?destination=${encodeURIComponent(destination)}`);
        }
        break;
      case 'search':
        const searchType = command.parameters.type as string;
        if (searchType === 'fuel') {
          navigate('/stops?filter=fuel');
        } else if (searchType === 'food') {
          navigate('/stops?filter=food');
        } else {
          navigate('/stops');
        }
        break;
      case 'report':
        navigate('/report');
        break;
      case 'info':
      case 'chat':
        toast.info(command.confirmation);
        break;
    }
  };

  const handleClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return null;
  }

  return (
    <div className="relative">
      <Button
        variant={isListening ? 'default' : 'secondary'}
        size={size}
        onClick={handleClick}
        disabled={isProcessing}
        className={cn(
          'relative',
          isListening && 'animate-pulse bg-red-500 hover:bg-red-600',
          className
        )}
      >
        {isProcessing ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isListening ? (
          <MicOff className="h-5 w-5" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </Button>

      {/* Transcript overlay */}
      {(isListening || isProcessing) && transcript && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-background border rounded-lg shadow-lg p-3">
          <p className="text-sm text-muted-foreground mb-1">
            {isProcessing ? 'Processando...' : 'Ouvindo...'}
          </p>
          <p className="text-sm font-medium">{transcript}</p>
          {isListening && (
            <div className="flex justify-center mt-2">
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
