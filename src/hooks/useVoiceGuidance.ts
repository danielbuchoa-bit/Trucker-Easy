import { useCallback, useRef, useEffect, useState } from 'react';
import { HereService, RouteInstruction } from '@/services/HereService';

export interface VoiceSettings {
  enabled: boolean;
  language: 'en-US' | 'pt-BR';
  rate: number;
  pitch: number;
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  language: 'en-US',
  rate: 0.9,
  pitch: 1,
};

const VOICE_STORAGE_KEY = 'voiceGuidanceSettings';

export function useVoiceGuidance() {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      return saved ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_VOICE_SETTINGS;
    } catch {
      return DEFAULT_VOICE_SETTINGS;
    }
  });

  const lastSpokenText = useRef<string | null>(null);
  const lastSpokenTime = useRef<number>(0);
  const currentInstructionIndex = useRef<number>(-1);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Speak text using Web Speech API
  const speak = useCallback((text: string, force: boolean = false) => {
    if (!settings.enabled) return;
    if (!text) return;

    // Prevent repeating same text within 10 seconds (unless forced)
    const now = Date.now();
    if (!force && text === lastSpokenText.current && now - lastSpokenTime.current < 10000) {
      return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.language;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;

    // Try to find a natural voice for the language
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(settings.language.split('-')[0]) && 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium'))
    ) || voices.find(v => v.lang.startsWith(settings.language.split('-')[0]));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
    lastSpokenText.current = text;
    lastSpokenTime.current = now;
  }, [settings]);

  // Speak a turn-by-turn instruction
  const speakInstruction = useCallback((
    instruction: RouteInstruction,
    distanceToManeuver: number,
    instructionIndex: number
  ) => {
    if (!settings.enabled) return;

    // Only speak if instruction changed or we're approaching the maneuver
    const isNewInstruction = instructionIndex !== currentInstructionIndex.current;
    const isApproaching = distanceToManeuver < 150 && distanceToManeuver > 30; // ~500ft
    const isImminent = distanceToManeuver < 30; // ~100ft

    if (isNewInstruction || isApproaching || isImminent) {
      currentInstructionIndex.current = instructionIndex;
      const voiceText = HereService.buildVoicePrompt(instruction, distanceToManeuver);
      speak(voiceText, isImminent);
    }
  }, [settings.enabled, speak]);

  // Speak arrival
  const speakArrival = useCallback(() => {
    speak('You have arrived at your destination.', true);
  }, [speak]);

  // Speak rerouting
  const speakRerouting = useCallback(() => {
    speak('Rerouting.', true);
  }, [speak]);

  // Repeat last instruction
  const repeatLastInstruction = useCallback(() => {
    if (lastSpokenText.current) {
      speak(lastSpokenText.current, true);
    }
  }, [speak]);

  // Stop speaking
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
  }, []);

  // Update settings
  const updateSettings = useCallback((updates: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  // Toggle voice on/off
  const toggleVoice = useCallback(() => {
    setSettings(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    settings,
    speak,
    speakInstruction,
    speakArrival,
    speakRerouting,
    repeatLastInstruction,
    stop,
    updateSettings,
    toggleVoice,
  };
}
