import { useCallback, useRef, useEffect, useState } from 'react';
import { Language } from '@/i18n/translations';

interface UseSpeedingAlertSoundProps {
  currentSpeedMph: number | null;
  speedLimitMph: number | null;
  enabled?: boolean;
  language?: Language;
  // How many mph over the limit before alerting
  toleranceMph?: number;
}

interface UseSpeedingAlertSoundReturn {
  isSpeeding: boolean;
  speedOverLimit: number;
  alertsEnabled: boolean;
  setAlertsEnabled: (enabled: boolean) => void;
  testAlert: () => void;
}

// Translations for speed alerts
const speedAlertMessages: Record<Language, { slowDown: string; overLimit: string; checkSpeed: string }> = {
  en: { slowDown: 'Slow down', overLimit: 'over limit', checkSpeed: 'Check your speed' },
  es: { slowDown: 'Reduzca la velocidad', overLimit: 'sobre el límite', checkSpeed: 'Verifique su velocidad' },
  pt: { slowDown: 'Reduza a velocidade', overLimit: 'acima do limite', checkSpeed: 'Verifique sua velocidade' },
  de: { slowDown: 'Langsamer fahren', overLimit: 'über dem Limit', checkSpeed: 'Geschwindigkeit prüfen' },
  fr: { slowDown: 'Ralentissez', overLimit: 'au-dessus de la limite', checkSpeed: 'Vérifiez votre vitesse' },
  hi: { slowDown: 'धीमा करें', overLimit: 'सीमा से ऊपर', checkSpeed: 'अपनी गति जांचें' },
};

const speechLangCodes: Record<Language, string> = {
  en: 'en-US',
  es: 'es-ES',
  pt: 'pt-BR',
  de: 'de-DE',
  fr: 'fr-FR',
  hi: 'hi-IN',
};

// Create audio context lazily to avoid autoplay policy issues
let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// Play a warning beep using Web Audio API
function playWarningBeep(type: 'warning' | 'critical' = 'warning') {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Different tones for different severity
    if (type === 'critical') {
      // Higher pitch, more urgent - two quick beeps
      oscillator.frequency.value = 880; // A5
      oscillator.type = 'square';
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.15);
      
      // Second beep
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 880;
          osc2.type = 'square';
          gain2.gain.setValueAtTime(0.3, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          osc2.start(ctx.currentTime);
          osc2.stop(ctx.currentTime + 0.15);
        } catch (e) {
          console.error('[SPEED_ALERT_SOUND] Second beep error:', e);
        }
      }, 200);
    } else {
      // Lower pitch, single beep
      oscillator.frequency.value = 660; // E5
      oscillator.type = 'triangle';
      gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.3);
    }
  } catch (error) {
    console.error('[SPEED_ALERT_SOUND] Failed to play beep:', error);
  }
}

// Play voice alert using Speech Synthesis
function playVoiceAlert(message: string, langCode: string) {
  try {
    if ('speechSynthesis' in window) {
      // Cancel any pending speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = langCode;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 0.9;
      
      // Try to find a voice for the specified language
      const voices = window.speechSynthesis.getVoices();
      const matchingVoice = voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
      if (matchingVoice) {
        utterance.voice = matchingVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  } catch (error) {
    console.error('[SPEED_ALERT_SOUND] Speech synthesis error:', error);
  }
}

export function useSpeedingAlertSound({
  currentSpeedMph,
  speedLimitMph,
  enabled = true,
  language = 'en',
  toleranceMph = 5,
}: UseSpeedingAlertSoundProps): UseSpeedingAlertSoundReturn {
  const [alertsEnabled, setAlertsEnabled] = useState(enabled);
  const hasAlertedRef = useRef<boolean>(false);

  // Calculate if speeding
  const isSpeeding = 
    currentSpeedMph !== null && 
    speedLimitMph !== null && 
    currentSpeedMph > speedLimitMph + toleranceMph;

  const speedOverLimit = 
    currentSpeedMph !== null && speedLimitMph !== null
      ? Math.max(0, currentSpeedMph - speedLimitMph)
      : 0;

  // Get messages for current language
  const messages = speedAlertMessages[language] || speedAlertMessages.en;
  const langCode = speechLangCodes[language] || 'en-US';

  // Test function to play alert sound
  const testAlert = useCallback(() => {
    playWarningBeep('warning');
    setTimeout(() => playVoiceAlert(messages.checkSpeed, langCode), 500);
  }, [messages, langCode]);

  // Reset alert flag when driver slows down
  useEffect(() => {
    if (!isSpeeding) {
      hasAlertedRef.current = false;
    }
  }, [isSpeeding]);

  // Trigger alert only once when speeding starts
  useEffect(() => {
    if (!alertsEnabled || !isSpeeding || hasAlertedRef.current) {
      return;
    }

    // Mark as alerted immediately to prevent multiple alerts
    hasAlertedRef.current = true;

    const isCritical = speedOverLimit > 15;

    console.log('[SPEED_ALERT_SOUND] Triggering ONE-TIME alert:', {
      currentSpeed: currentSpeedMph,
      limit: speedLimitMph,
      over: speedOverLimit,
      critical: isCritical,
      language,
    });

    // Play appropriate alert
    if (isCritical) {
      playWarningBeep('critical');
      setTimeout(() => {
        playVoiceAlert(`${messages.slowDown}. ${Math.round(speedOverLimit)} ${messages.overLimit}.`, langCode);
      }, 400);
    } else {
      playWarningBeep('warning');
      setTimeout(() => {
        playVoiceAlert(messages.checkSpeed, langCode);
      }, 400);
    }
  }, [isSpeeding, speedOverLimit, alertsEnabled, currentSpeedMph, speedLimitMph, messages, langCode, language]);

  // Initialize voices (needed for some browsers)
  useEffect(() => {
    if ('speechSynthesis' in window) {
      // Load voices
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  return {
    isSpeeding,
    speedOverLimit,
    alertsEnabled,
    setAlertsEnabled,
    testAlert,
  };
}
