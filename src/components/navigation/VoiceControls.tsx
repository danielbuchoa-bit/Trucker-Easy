import React, { useState } from 'react';
import { Volume2, VolumeX, Settings, Mic, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  onUpdateSettings,
  onUnlockVoice,
}: VoiceControlsProps) => {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const isPt = language === 'pt';

  // Show unlock button prominently if voice is enabled but not unlocked
  const needsUnlock = settings.enabled && voiceState.isAvailable && !voiceState.isUnlocked;

  return (
    <div className="absolute bottom-32 left-4 z-30 flex flex-col gap-2">
      {/* Unlock Voice Button - appears when Safari blocks autoplay */}
      {needsUnlock && (
        <Button
          variant="default"
          size="lg"
          onClick={onUnlockVoice}
          className="rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-white animate-pulse flex items-center gap-2 px-4"
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
        className={`rounded-full shadow-lg ${
          settings.enabled && voiceState.isUnlocked 
            ? 'bg-primary' 
            : settings.enabled && !voiceState.isUnlocked
            ? 'bg-orange-500 hover:bg-orange-600'
            : ''
        }`}
      >
        {settings.enabled ? (
          <Volume2 className="w-5 h-5" />
        ) : (
          <VolumeX className="w-5 h-5" />
        )}
      </Button>

      {/* Settings sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full shadow-lg"
          >
            <Settings className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {isPt ? 'Configurações de Voz' : 'Voice Settings'}
            </SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Status indicator */}
            <Alert variant={voiceState.isUnlocked ? 'default' : 'destructive'}>
              <AlertDescription className="text-sm">
                {!voiceState.isAvailable ? (
                  isPt ? '❌ Síntese de voz não disponível neste navegador' : '❌ Speech synthesis not available in this browser'
                ) : !voiceState.isUnlocked ? (
                  isPt ? '⚠️ Toque em "Ativar Voz" para desbloquear áudio' : '⚠️ Tap "Activate Voice" to unlock audio'
                ) : (
                  isPt ? '✅ Voz ativada e pronta' : '✅ Voice activated and ready'
                )}
              </AlertDescription>
            </Alert>

            {/* Unlock button (in settings) */}
            {voiceState.isAvailable && !voiceState.isUnlocked && (
              <Button
                variant="default"
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => {
                  onUnlockVoice();
                }}
              >
                <Mic className="w-4 h-4 mr-2" />
                {isPt ? 'Ativar Voz' : 'Activate Voice'}
              </Button>
            )}

            {/* Voice On/Off */}
            <div className="flex items-center justify-between">
              <Label htmlFor="voice-enabled">
                {isPt ? 'Orientação por Voz' : 'Voice Guidance'}
              </Label>
              <Switch
                id="voice-enabled"
                checked={settings.enabled}
                onCheckedChange={(enabled) => onUpdateSettings({ enabled })}
              />
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>{isPt ? 'Idioma' : 'Language'}</Label>
              <Select
                value={settings.language}
                onValueChange={(lang: 'en-US' | 'pt-BR' | 'pt-PT') => 
                  onUpdateSettings({ language: lang })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                  <SelectItem value="pt-PT">Português (Portugal)</SelectItem>
                  <SelectItem value="en-US">English (US)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Speech Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{isPt ? 'Velocidade' : 'Speed'}</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.rate.toFixed(1)}x
                </span>
              </div>
              <Slider
                value={[settings.rate]}
                onValueChange={([rate]) => onUpdateSettings({ rate })}
                min={0.5}
                max={1.5}
                step={0.1}
              />
            </div>

            {/* Pitch */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{isPt ? 'Tom' : 'Pitch'}</Label>
                <span className="text-sm text-muted-foreground">
                  {settings.pitch.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[settings.pitch]}
                onValueChange={([pitch]) => onUpdateSettings({ pitch })}
                min={0.5}
                max={1.5}
                step={0.1}
              />
            </div>

            {/* Test voice */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                if (!voiceState.isUnlocked) {
                  onUnlockVoice();
                  return;
                }
                
                const testText = settings.language.startsWith('pt')
                  ? 'Em 500 metros, vire à direita na Avenida Principal.'
                  : 'In 500 feet, turn right onto Main Street.';
                  
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(testText);
                utterance.lang = settings.language;
                utterance.rate = settings.rate;
                utterance.pitch = settings.pitch;
                window.speechSynthesis.speak(utterance);
              }}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              {isPt ? 'Testar Voz' : 'Test Voice'}
            </Button>

            {/* Debug section (dev mode) */}
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDebug(!showDebug)}
                className="text-xs text-muted-foreground"
              >
                {showDebug ? 'Hide Debug' : 'Show Debug'}
              </Button>
              
              {showDebug && (
                <div className="mt-2 p-2 bg-muted rounded text-xs font-mono space-y-1 max-h-40 overflow-y-auto">
                  <div>Available: {voiceState.isAvailable ? '✅' : '❌'}</div>
                  <div>Unlocked: {voiceState.isUnlocked ? '✅' : '❌'}</div>
                  <div>Speaking: {voiceState.isSpeaking ? '🔊' : '🔇'}</div>
                  <div>Enabled: {settings.enabled ? '✅' : '❌'}</div>
                  <div>Language: {settings.language}</div>
                  {voiceState.lastSpokenText && (
                    <div className="truncate">
                      Last: "{voiceState.lastSpokenText.substring(0, 30)}..."
                    </div>
                  )}
                  <div className="mt-2 border-t pt-2">
                    <div className="font-bold mb-1">Log:</div>
                    {voiceState.debugLog.slice(-5).map((log, i) => (
                      <div key={i} className="text-[10px] opacity-70">{log}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default VoiceControls;
