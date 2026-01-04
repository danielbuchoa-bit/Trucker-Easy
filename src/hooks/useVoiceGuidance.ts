import { useCallback, useRef, useEffect, useState } from 'react';
import { HereService, RouteInstruction } from '@/services/HereService';
import { useLanguage } from '@/i18n/LanguageContext';

export interface VoiceSettings {
  enabled: boolean;
  language: 'en-US' | 'pt-BR' | 'pt-PT';
  rate: number;
  pitch: number;
}

export interface VoiceState {
  isUnlocked: boolean; // True if user has interacted to unlock audio
  isAvailable: boolean; // True if speechSynthesis is available
  isSpeaking: boolean;
  lastSpokenText: string | null;
  lastSpokenTime: number | null;
  debugLog: string[];
}

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: true,
  language: 'pt-BR',
  rate: 0.9,
  pitch: 1,
};

const VOICE_STORAGE_KEY = 'voiceGuidanceSettings';
const VOICE_UNLOCKED_KEY = 'voiceUnlocked';
const DEBUG_LOG_MAX = 20;
const REROUTE_COOLDOWN_MS = 25000; // 25 seconds cooldown between "recalculating" announcements
const DUPLICATE_TEXT_COOLDOWN_MS = 10000; // 10 seconds before repeating same text

// Check if running in dev mode
const isDev = import.meta.env.DEV;

export function useVoiceGuidance() {
  const { language: appLanguage } = useLanguage();
  
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem(VOICE_STORAGE_KEY);
      const parsed = saved ? { ...DEFAULT_VOICE_SETTINGS, ...JSON.parse(saved) } : DEFAULT_VOICE_SETTINGS;
      // Sync language with app language
      if (appLanguage === 'pt') {
        parsed.language = 'pt-BR';
      } else if (appLanguage === 'en') {
        parsed.language = 'en-US';
      }
      return parsed;
    } catch {
      return DEFAULT_VOICE_SETTINGS;
    }
  });

  const [voiceState, setVoiceState] = useState<VoiceState>(() => ({
    isUnlocked: localStorage.getItem(VOICE_UNLOCKED_KEY) === 'true',
    isAvailable: typeof window !== 'undefined' && 'speechSynthesis' in window,
    isSpeaking: false,
    lastSpokenText: null,
    lastSpokenTime: null,
    debugLog: [],
  }));

  const lastSpokenTextRef = useRef<string | null>(null);
  const lastSpokenTimeRef = useRef<number>(0);
  const lastRerouteSpokenRef = useRef<number>(0); // Separate cooldown for reroute announcements
  const currentInstructionIndexRef = useRef<number>(-1);
  const speakQueueRef = useRef<string[]>([]);
  const isReroutingStateRef = useRef<boolean>(false); // Track rerouting state to prevent spam

  // Debug logger
  const addDebugLog = useCallback((message: string) => {
    if (isDev) {
      console.log(`[TTS] ${message}`);
    }
    setVoiceState(prev => ({
      ...prev,
      debugLog: [...prev.debugLog.slice(-DEBUG_LOG_MAX + 1), `${new Date().toLocaleTimeString()}: ${message}`],
    }));
  }, []);

  // Save settings to localStorage
  useEffect(() => {
    localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  // Check availability on mount
  useEffect(() => {
    const isAvailable = typeof window !== 'undefined' && 'speechSynthesis' in window;
    setVoiceState(prev => ({ ...prev, isAvailable }));
    
    if (!isAvailable) {
      addDebugLog('speechSynthesis NOT available in this browser');
    } else {
      addDebugLog('speechSynthesis available');
      
      // Load voices (some browsers need this)
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        addDebugLog(`Loaded ${voices.length} voices`);
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [addDebugLog]);

  // Sync language with app language
  useEffect(() => {
    if (appLanguage === 'pt' && settings.language !== 'pt-BR' && settings.language !== 'pt-PT') {
      setSettings(prev => ({ ...prev, language: 'pt-BR' }));
    } else if (appLanguage === 'en' && settings.language !== 'en-US') {
      setSettings(prev => ({ ...prev, language: 'en-US' }));
    }
  }, [appLanguage, settings.language]);

  // Unlock voice - MUST be called from user gesture (click/tap)
  const unlockVoice = useCallback(() => {
    if (!voiceState.isAvailable) {
      addDebugLog('Cannot unlock: speechSynthesis not available');
      return false;
    }

    addDebugLog('Attempting to unlock voice via user gesture...');
    
    // Cancel any pending speech
    window.speechSynthesis.cancel();
    
    // Create a test utterance with the user gesture
    const testText = settings.language.startsWith('pt') 
      ? 'Voz ativada' 
      : 'Voice activated';
    
    const utterance = new SpeechSynthesisUtterance(testText);
    utterance.lang = settings.language;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = 1;
    
    // Find appropriate voice
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = settings.language.split('-')[0];
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(langPrefix) && 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium') || v.name.includes('Luciana') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang.startsWith(langPrefix));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
      addDebugLog(`Using voice: ${preferredVoice.name} (${preferredVoice.lang})`);
    } else {
      addDebugLog(`No voice found for ${langPrefix}, using default`);
    }
    
    utterance.onstart = () => {
      addDebugLog('Unlock utterance started - voice is now unlocked!');
      setVoiceState(prev => ({ ...prev, isUnlocked: true, isSpeaking: true }));
      localStorage.setItem(VOICE_UNLOCKED_KEY, 'true');
    };
    
    utterance.onend = () => {
      addDebugLog('Unlock utterance ended');
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    };
    
    utterance.onerror = (event) => {
      addDebugLog(`Unlock error: ${event.error}`);
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    };
    
    window.speechSynthesis.speak(utterance);
    
    return true;
  }, [voiceState.isAvailable, settings.language, settings.rate, settings.pitch, addDebugLog]);

  // Core speak function
  const speak = useCallback((text: string, force: boolean = false) => {
    if (!settings.enabled) {
      addDebugLog(`Speak blocked: voice disabled`);
      return;
    }
    
    if (!voiceState.isAvailable) {
      addDebugLog(`Speak blocked: speechSynthesis not available`);
      return;
    }
    
    if (!voiceState.isUnlocked) {
      addDebugLog(`Speak blocked: voice not unlocked (needs user gesture)`);
      return;
    }
    
    if (!text || text.trim() === '') {
      addDebugLog(`Speak blocked: empty text`);
      return;
    }

    // Deduplicate: prevent repeating same text within cooldown (unless forced)
    const now = Date.now();
    const timeSinceLastSpeak = now - lastSpokenTimeRef.current;
    
    if (!force && text === lastSpokenTextRef.current && timeSinceLastSpeak < DUPLICATE_TEXT_COOLDOWN_MS) {
      addDebugLog(`Speak blocked: duplicate text within ${Math.round(timeSinceLastSpeak/1000)}s`);
      return;
    }

    // Cancel any ongoing speech to prevent overlap/echo
    window.speechSynthesis.cancel();
    addDebugLog(`Speaking: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = settings.language;
    utterance.rate = settings.rate;
    utterance.pitch = settings.pitch;
    utterance.volume = 1;

    // Find appropriate voice
    const voices = window.speechSynthesis.getVoices();
    const langPrefix = settings.language.split('-')[0];
    const preferredVoice = voices.find(v => 
      v.lang.startsWith(langPrefix) && 
      (v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Premium') || v.name.includes('Luciana') || v.name.includes('Daniel'))
    ) || voices.find(v => v.lang.startsWith(langPrefix));
    
    if (preferredVoice) {
      utterance.voice = preferredVoice;
    }

    utterance.onstart = () => {
      setVoiceState(prev => ({ 
        ...prev, 
        isSpeaking: true,
        lastSpokenText: text,
        lastSpokenTime: now,
      }));
    };
    
    utterance.onend = () => {
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
      addDebugLog('Speech ended');
    };
    
    utterance.onerror = (event) => {
      addDebugLog(`Speech error: ${event.error}`);
      setVoiceState(prev => ({ ...prev, isSpeaking: false }));
      
      // If error is "not-allowed", mark as locked
      if (event.error === 'not-allowed') {
        setVoiceState(prev => ({ ...prev, isUnlocked: false }));
        localStorage.removeItem(VOICE_UNLOCKED_KEY);
        addDebugLog('Voice locked due to not-allowed error');
      }
    };

    window.speechSynthesis.speak(utterance);
    lastSpokenTextRef.current = text;
    lastSpokenTimeRef.current = now;
  }, [settings, voiceState.isAvailable, voiceState.isUnlocked, addDebugLog]);

  // Speak a turn-by-turn instruction
  const speakInstruction = useCallback((
    instruction: RouteInstruction,
    distanceToManeuver: number,
    instructionIndex: number
  ) => {
    if (!settings.enabled || !voiceState.isUnlocked) return;

    // Only speak if instruction changed or we're approaching the maneuver
    const isNewInstruction = instructionIndex !== currentInstructionIndexRef.current;
    const isApproaching = distanceToManeuver < 150 && distanceToManeuver > 30; // ~500ft
    const isImminent = distanceToManeuver < 30; // ~100ft

    if (isNewInstruction || isApproaching || isImminent) {
      currentInstructionIndexRef.current = instructionIndex;
      const voiceText = HereService.buildVoicePrompt(instruction, distanceToManeuver);
      speak(voiceText, isImminent);
    }
  }, [settings.enabled, voiceState.isUnlocked, speak]);

  // Speak arrival
  const speakArrival = useCallback(() => {
    const text = settings.language.startsWith('pt')
      ? 'Você chegou ao seu destino.'
      : 'You have arrived at your destination.';
    speak(text, true);
  }, [settings.language, speak]);

  // Speak rerouting (with dedicated cooldown to prevent spam)
  const speakRerouting = useCallback(() => {
    const now = Date.now();
    const timeSinceLastReroute = now - lastRerouteSpokenRef.current;
    
    // Check cooldown - don't spam "recalculating" announcements
    if (timeSinceLastReroute < REROUTE_COOLDOWN_MS) {
      console.log(`[TTS] Reroute announcement blocked: cooldown (${Math.round(timeSinceLastReroute/1000)}s since last)`);
      return;
    }
    
    // Check if we're already in rerouting state (prevent multiple calls during same reroute)
    if (isReroutingStateRef.current) {
      console.log('[TTS] Reroute announcement blocked: already in rerouting state');
      return;
    }
    
    isReroutingStateRef.current = true;
    lastRerouteSpokenRef.current = now;
    
    const text = settings.language.startsWith('pt')
      ? 'Recalculando rota.'
      : 'Rerouting.';
    
    speak(text, true);
    
    // Reset rerouting state after a delay
    setTimeout(() => {
      isReroutingStateRef.current = false;
    }, 5000);
  }, [settings.language, speak]);

  // Repeat last instruction
  const repeatLastInstruction = useCallback(() => {
    if (lastSpokenTextRef.current) {
      speak(lastSpokenTextRef.current, true);
    }
  }, [speak]);

  // Stop speaking
  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setVoiceState(prev => ({ ...prev, isSpeaking: false }));
    addDebugLog('Speech cancelled');
  }, [addDebugLog]);

  // Update settings
  const updateSettings = useCallback((updates: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    addDebugLog(`Settings updated: ${JSON.stringify(updates)}`);
  }, [addDebugLog]);

  // Toggle voice on/off
  const toggleVoice = useCallback(() => {
    setSettings(prev => {
      const newEnabled = !prev.enabled;
      addDebugLog(`Voice ${newEnabled ? 'enabled' : 'disabled'}`);
      return { ...prev, enabled: newEnabled };
    });
  }, [addDebugLog]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  return {
    settings,
    voiceState,
    speak,
    speakInstruction,
    speakArrival,
    speakRerouting,
    repeatLastInstruction,
    stop,
    updateSettings,
    toggleVoice,
    unlockVoice,
  };
}
