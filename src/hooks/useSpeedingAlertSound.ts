import { useCallback, useRef, useEffect, useState } from 'react';

interface UseSpeedingAlertSoundProps {
  currentSpeedMph: number | null;
  speedLimitMph: number | null;
  enabled?: boolean;
  // How many mph over the limit before alerting
  toleranceMph?: number;
  // Minimum interval between alerts (ms)
  alertIntervalMs?: number;
}

interface UseSpeedingAlertSoundReturn {
  isSpeeding: boolean;
  speedOverLimit: number;
  alertsEnabled: boolean;
  setAlertsEnabled: (enabled: boolean) => void;
  testAlert: () => void;
}

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
function playVoiceAlert(message: string) {
  try {
    if ('speechSynthesis' in window) {
      // Cancel any pending speech
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.volume = 0.8;
      
      // Try to use a natural voice
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en') && v.name.includes('Google'));
      if (englishVoice) {
        utterance.voice = englishVoice;
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
  toleranceMph = 5,
  alertIntervalMs = 10000, // 10 seconds between alerts
}: UseSpeedingAlertSoundProps): UseSpeedingAlertSoundReturn {
  const [alertsEnabled, setAlertsEnabled] = useState(enabled);
  const lastAlertTimeRef = useRef<number>(0);
  const wasSpeedingRef = useRef<boolean>(false);
  const speedingStartTimeRef = useRef<number | null>(null);

  // Calculate if speeding
  const isSpeeding = 
    currentSpeedMph !== null && 
    speedLimitMph !== null && 
    currentSpeedMph > speedLimitMph + toleranceMph;

  const speedOverLimit = 
    currentSpeedMph !== null && speedLimitMph !== null
      ? Math.max(0, currentSpeedMph - speedLimitMph)
      : 0;

  // Test function to play alert sound
  const testAlert = useCallback(() => {
    playWarningBeep('warning');
    setTimeout(() => playVoiceAlert('Speed alert test'), 500);
  }, []);

  // Monitor speeding and trigger alerts
  useEffect(() => {
    if (!alertsEnabled) {
      wasSpeedingRef.current = false;
      speedingStartTimeRef.current = null;
      return;
    }

    const now = Date.now();

    if (isSpeeding) {
      // Track when speeding started
      if (!speedingStartTimeRef.current) {
        speedingStartTimeRef.current = now;
      }

      const speedingDuration = now - speedingStartTimeRef.current;
      const timeSinceLastAlert = now - lastAlertTimeRef.current;

      // Determine alert type based on how much over the limit
      const isCritical = speedOverLimit > 15; // More than 15 mph over

      // Alert conditions:
      // 1. Just started speeding (wasn't speeding before)
      // 2. Been speeding for a while and interval has passed
      // 3. Critical speeding (much higher than limit)
      
      const shouldAlert = 
        (!wasSpeedingRef.current && speedingDuration > 1000) || // New speeding after 1 second
        (wasSpeedingRef.current && timeSinceLastAlert > alertIntervalMs) || // Repeat alert
        (isCritical && timeSinceLastAlert > 5000); // Critical - more frequent

      if (shouldAlert) {
        console.log('[SPEED_ALERT_SOUND] Triggering alert:', {
          currentSpeed: currentSpeedMph,
          limit: speedLimitMph,
          over: speedOverLimit,
          critical: isCritical,
        });

        // Play appropriate alert
        if (isCritical) {
          playWarningBeep('critical');
          setTimeout(() => {
            playVoiceAlert(`Slow down. ${Math.round(speedOverLimit)} over limit.`);
          }, 400);
        } else {
          playWarningBeep('warning');
          // Only voice alert on first detection or after long interval
          if (!wasSpeedingRef.current || timeSinceLastAlert > 30000) {
            setTimeout(() => {
              playVoiceAlert('Check your speed');
            }, 400);
          }
        }

        lastAlertTimeRef.current = now;
      }

      wasSpeedingRef.current = true;
    } else {
      // Reset speeding state
      wasSpeedingRef.current = false;
      speedingStartTimeRef.current = null;
    }
  }, [isSpeeding, speedOverLimit, alertsEnabled, alertIntervalMs, currentSpeedMph, speedLimitMph]);

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
