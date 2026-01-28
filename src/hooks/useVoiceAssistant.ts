import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/i18n/LanguageContext';

interface VoiceCommandResult {
  action: 'navigate' | 'search' | 'report' | 'info' | 'chat';
  parameters: Record<string, unknown>;
  confirmation: string;
  confidence: number;
}

// Map app language to speech recognition locale
const getSpeechLocale = (appLang: string): string => {
  switch (appLang) {
    case 'pt': return 'pt-BR';
    case 'es': return 'es-MX';
    case 'en':
    default: return 'en-US';
  }
};

// Localized error messages
const getErrorMessages = (appLang: string) => {
  switch (appLang) {
    case 'pt':
      return {
        micDenied: 'Permissão de microfone negada',
        notSupported: 'Reconhecimento de voz não suportado neste navegador',
        processError: 'Erro ao processar comando de voz',
      };
    case 'es':
      return {
        micDenied: 'Permiso de micrófono denegado',
        notSupported: 'Reconocimiento de voz no soportado en este navegador',
        processError: 'Error al procesar comando de voz',
      };
    default:
      return {
        micDenied: 'Microphone permission denied',
        notSupported: 'Voice recognition not supported in this browser',
        processError: 'Error processing voice command',
      };
  }
};

export function useVoiceAssistant() {
  const { language: appLanguage } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommandResult | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const speechLocale = getSpeechLocale(appLanguage);
  const errorMessages = getErrorMessages(appLanguage);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = speechLocale;

    recognitionRef.current.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      const text = last[0].transcript;
      setTranscript(text);

      if (last.isFinal) {
        processCommand(text);
      }
    };

    recognitionRef.current.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      if (event.error === 'not-allowed') {
        toast.error(errorMessages.micDenied);
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognitionRef.current?.abort();
    };
  }, [isSupported, speechLocale, errorMessages.micDenied]);

  const processCommand = async (text: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice_command', {
        body: { 
          transcript: text,
          language: appLanguage, // Send the app language to the edge function
          context: {
            current_route: window.location.pathname.includes('navigation')
          }
        }
      });

      if (error) throw error;

      setLastCommand(data);
      
      // Speak confirmation in the user's language
      if ('speechSynthesis' in window && data.confirmation) {
        const utterance = new SpeechSynthesisUtterance(data.confirmation);
        utterance.lang = speechLocale;
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
      }

      return data as VoiceCommandResult;
    } catch (err) {
      console.error('Voice command processing error:', err);
      toast.error(errorMessages.processError);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      toast.error(errorMessages.notSupported);
      return;
    }

    // Update language before starting
    recognitionRef.current.lang = speechLocale;
    
    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  }, [isSupported, speechLocale, errorMessages.notSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLocale;
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, [speechLocale]);

  return {
    isSupported,
    isListening,
    isProcessing,
    transcript,
    lastCommand,
    startListening,
    stopListening,
    speak,
    processCommand,
  };
}

// Add type declarations for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}
