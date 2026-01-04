import React, { useState } from 'react';
import { Volume2, VolumeX, Settings } from 'lucide-react';
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
import type { VoiceSettings } from '@/hooks/useVoiceGuidance';

interface VoiceControlsProps {
  settings: VoiceSettings;
  onToggle: () => void;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
}

const VoiceControls = ({ settings, onToggle, onUpdateSettings }: VoiceControlsProps) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute bottom-32 left-4 z-30 flex flex-col gap-2">
      {/* Quick toggle button */}
      <Button
        variant={settings.enabled ? 'default' : 'secondary'}
        size="icon"
        onClick={onToggle}
        className="rounded-full shadow-lg"
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
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle>Voice Settings</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-6">
            {/* Voice On/Off */}
            <div className="flex items-center justify-between">
              <Label htmlFor="voice-enabled">Voice Guidance</Label>
              <Switch
                id="voice-enabled"
                checked={settings.enabled}
                onCheckedChange={(enabled) => onUpdateSettings({ enabled })}
              />
            </div>

            {/* Language */}
            <div className="space-y-2">
              <Label>Language</Label>
              <Select
                value={settings.language}
                onValueChange={(language: 'en-US' | 'pt-BR') => 
                  onUpdateSettings({ language })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en-US">English (US)</SelectItem>
                  <SelectItem value="pt-BR">Português (BR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Speech Rate */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Speed</Label>
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
                <Label>Pitch</Label>
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
                const utterance = new SpeechSynthesisUtterance(
                  settings.language === 'pt-BR' 
                    ? 'Em 500 metros, vire à direita na Avenida Principal.'
                    : 'In 500 feet, turn right onto Main Street.'
                );
                utterance.lang = settings.language;
                utterance.rate = settings.rate;
                utterance.pitch = settings.pitch;
                window.speechSynthesis.cancel();
                window.speechSynthesis.speak(utterance);
              }}
            >
              <Volume2 className="w-4 h-4 mr-2" />
              Test Voice
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default VoiceControls;
