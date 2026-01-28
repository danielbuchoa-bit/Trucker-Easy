import React, { useState } from 'react';
import { Volume2, Mic } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
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

interface VoiceSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: VoiceSettings;
  voiceState: VoiceState;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
  onUnlockVoice: () => void;
}

const VoiceSettingsSheet = ({ 
  open,
  onOpenChange,
  settings, 
  voiceState,
  onUpdateSettings,
  onUnlockVoice,
}: VoiceSettingsSheetProps) => {
  const { language } = useLanguage();
  const [showDebug, setShowDebug] = useState(false);

  const isPt = language === 'pt';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
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
              className="w-full bg-primary hover:bg-primary/90"
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
            <Label>{isPt ? 'Idioma' : language === 'es' ? 'Idioma' : 'Language'}</Label>
            <Select
              value={settings.language}
              onValueChange={(lang: 'en-US' | 'pt-BR' | 'pt-PT' | 'es-ES' | 'es-MX') => 
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
                <SelectItem value="es-MX">Español (México)</SelectItem>
                <SelectItem value="es-ES">Español (España)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {isPt ? 'Sincroniza automaticamente com o idioma do app' : 
               language === 'es' ? 'Se sincroniza automáticamente con el idioma de la app' :
               'Automatically syncs with app language'}
            </p>
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
                : settings.language.startsWith('es')
                ? 'En 500 metros, gire a la derecha en la Avenida Principal.'
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
  );
};

export default VoiceSettingsSheet;