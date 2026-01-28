import React from 'react';
import { Volume2, VolumeX, Mic, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { VoiceSettings, VoiceState } from '@/hooks/useVoiceGuidance';
import { useLanguage } from '@/i18n/LanguageContext';

interface VoiceControlsProps {
  settings: VoiceSettings;
  voiceState: VoiceState;
  onToggle: () => void;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
  onUnlockVoice: () => void;
}

const VoiceControls = ({ 
  settings, 
  voiceState,
  onToggle, 
  onUnlockVoice,
}: VoiceControlsProps) => {
  const { language } = useLanguage();

  const isPt = language === 'pt';

  // Show unlock button prominently if voice is enabled but not unlocked
  const needsUnlock = settings.enabled && voiceState.isAvailable && !voiceState.isUnlocked;

  return (
    <div className="absolute bottom-36 left-4 z-30 flex flex-col items-start gap-3">
      {/* Unlock Voice Button - appears when Safari blocks autoplay */}
      {needsUnlock && (
        <Button
          variant="default"
          size="lg"
          onClick={onUnlockVoice}
          className="rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground animate-pulse flex items-center gap-2 px-4"
        >
          <Mic className="w-5 h-5" />
          <span className="font-medium">
            {isPt ? 'Ativar Voz' : 'Activate Voice'}
          </span>
        </Button>
      )}

      {/* Voice not available warning */}
      {!voiceState.isAvailable && settings.enabled && (
        <div className="bg-destructive/90 text-destructive-foreground rounded-lg p-2 text-xs max-w-[200px]">
          <div className="flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            <span>{isPt ? 'Voz indisponível' : 'Voice unavailable'}</span>
          </div>
        </div>
      )}

      {/* Speaking indicator */}
      {voiceState.isSpeaking && (
        <div className="bg-primary/90 text-primary-foreground rounded-full px-3 py-1 text-xs flex items-center gap-2 animate-pulse">
          <Volume2 className="w-4 h-4" />
          <span>{isPt ? 'Falando...' : 'Speaking...'}</span>
        </div>
      )}

      {/* Quick toggle button */}
      <Button
        variant={settings.enabled && voiceState.isUnlocked ? 'default' : 'secondary'}
        size="icon"
        onClick={() => {
          if (!voiceState.isUnlocked && settings.enabled) {
            // If not unlocked, trigger unlock instead
            onUnlockVoice();
          } else {
            onToggle();
          }
        }}
        className={cn(
          "rounded-full shadow-lg w-12 h-12",
          settings.enabled && voiceState.isUnlocked 
            ? 'bg-primary hover:bg-primary/90' 
            : settings.enabled && !voiceState.isUnlocked
            ? 'bg-orange-500 hover:bg-orange-600'
            : 'bg-background/90 backdrop-blur-sm'
        )}
      >
        {settings.enabled ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </Button>
    </div>
  );
};

export default VoiceControls;