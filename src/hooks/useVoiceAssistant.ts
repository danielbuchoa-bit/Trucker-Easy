import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface VoiceCommandResult {
  action: 'navigate' | 'search' | 'report' | 'info' | 'chat';
  parameters: Record<string, unknown>;
  confirmation: string;
  confidence: number;
}

export function useVoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommandResult | null>(null);
  const recognitionRef = useRef<any>(null);

  const isSupported = typeof window !== 'undefined' && 
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = true;
    recognitionRef.current.lang = 'pt-BR';

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
        toast.error('Permissão de microfone negada');
      }
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    return () => {
      recognitionRef.current?.abort();
    };
  }, [isSupported]);

  const processCommand = async (text: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('voice_command', {
        body: { 
          transcript: text,
          context: {
            current_route: window.location.pathname.includes('navigation')
          }
        }
      });

      if (error) throw error;

      setLastCommand(data);
      
      // Speak confirmation
      if ('speechSynthesis' in window && data.confirmation) {
        const utterance = new SpeechSynthesisUtterance(data.confirmation);
        utterance.lang = 'pt-BR';
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
      }

      return data as VoiceCommandResult;
    } catch (err) {
      console.error('Voice command processing error:', err);
      toast.error('Erro ao processar comando de voz');
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      toast.error('Reconhecimento de voz não suportado neste navegador');
      return;
    }

    setTranscript('');
    setIsListening(true);
    try {
      recognitionRef.current.start();
    } catch (err) {
      console.error('Failed to start recognition:', err);
      setIsListening(false);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const speak = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }, []);

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
