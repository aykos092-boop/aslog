import { useCallback, useRef, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface VoiceNavigationOptions {
  enabled?: boolean;
  language?: string;
  premium?: boolean;
}

// Constants for rate limiting
const MAX_QUEUE_SIZE = 3;
const PHRASE_COOLDOWN_MS = 15000; // 15 seconds between identical phrases

export const useVoiceNavigation = (options: VoiceNavigationOptions = {}) => {
  const { enabled = true, language = "ru", premium = false } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(premium);
  const { toast } = useToast();
  
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const recentPhrasesRef = useRef<Map<string, number>>(new Map());
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const voicesLoadedRef = useRef(false);
  const toastShownRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      synthRef.current = window.speechSynthesis;
      
      const loadVoices = () => {
        const voices = synthRef.current?.getVoices() || [];
        voicesLoadedRef.current = voices.length > 0;
      };
      
      loadVoices();
      synthRef.current.addEventListener("voiceschanged", loadVoices);
      
      return () => {
        synthRef.current?.removeEventListener("voiceschanged", loadVoices);
      };
    }
  }, []);

  // Initialize AudioContext for premium TTS
  useEffect(() => {
    if (isPremium && typeof window !== "undefined") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return () => {
      audioContextRef.current?.close();
    };
  }, [isPremium]);

  // Get best voice for language
  const getBestVoice = useCallback((lang: string): SpeechSynthesisVoice | null => {
    if (!synthRef.current) return null;
    
    const voices = synthRef.current.getVoices();
    const langCode = lang === "ru" ? "ru" : "en";
    
    // Prefer Google voices, then Microsoft, then any
    let voice = voices.find(v => 
      v.lang.startsWith(langCode) && 
      (v.name.includes("Google") || v.name.includes("Microsoft"))
    );
    if (!voice) {
      voice = voices.find(v => v.lang.startsWith(langCode) && v.localService);
    }
    if (!voice) {
      voice = voices.find(v => v.lang.startsWith(langCode));
    }
    if (!voice && voices.length > 0) {
      voice = voices[0];
    }
    
    return voice || null;
  }, []);

  // Check if phrase was recently spoken (deduplication)
  const isDuplicatePhrase = useCallback((text: string): boolean => {
    const now = Date.now();
    
    // Clean old entries
    for (const [phrase, timestamp] of recentPhrasesRef.current) {
      if (now - timestamp > PHRASE_COOLDOWN_MS) {
        recentPhrasesRef.current.delete(phrase);
      }
    }
    
    const lastSpoken = recentPhrasesRef.current.get(text);
    if (lastSpoken && now - lastSpoken < PHRASE_COOLDOWN_MS) {
      return true;
    }
    
    recentPhrasesRef.current.set(text, now);
    return false;
  }, []);

  // Premium TTS using Google Cloud TTS via Edge Function
  const speakWithPremiumTTS = useCallback(async (text: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("navigation-tts", {
        body: { text, language, premium: true },
      });

      if (error) {
        console.error("Premium TTS error:", error);
        return false;
      }

      // If API returns audio data
      if (data.audioContent) {
        const audioData = Uint8Array.from(atob(data.audioContent), c => c.charCodeAt(0));
        
        if (audioContextRef.current) {
          const audioBuffer = await audioContextRef.current.decodeAudioData(audioData.buffer);
          const source = audioContextRef.current.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(audioContextRef.current.destination);
          
          return new Promise((resolve) => {
            source.onended = () => {
              setIsSpeaking(false);
              resolve(true);
            };
            setIsSpeaking(true);
            source.start();
          });
        }
      }

      // Fallback to browser TTS
      if (data.useBrowserTTS) {
        return false;
      }

      return false;
    } catch (err) {
      console.error("Premium TTS failed:", err);
      return false;
    }
  }, [language]);

  // Speak using browser's Web Speech API
  const speakWithBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!synthRef.current) {
        resolve();
        return;
      }

      // Cancel any ongoing speech
      synthRef.current.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const voice = getBestVoice(language);
      
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.lang = language === "ru" ? "ru-RU" : "en-US";
      utterance.rate = 1.1; // Slightly faster for navigation
      utterance.pitch = 1;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      synthRef.current.speak(utterance);
    });
  }, [language, getBestVoice]);

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text) return;

    // Check browser support
    if (!synthRef.current && !isPremium) {
      if (!toastShownRef.current) {
        toastShownRef.current = true;
        toast({
          title: "Голос недоступен",
          description: "Ваш браузер не поддерживает синтез речи",
        });
      }
      return;
    }

    // Deduplication - skip if same phrase was spoken recently
    if (isDuplicatePhrase(text)) {
      return;
    }

    // Queue size limit
    if (queueRef.current.length >= MAX_QUEUE_SIZE) {
      return;
    }

    queueRef.current.push(text);
    
    if (isPlayingRef.current) return;

    const processQueue = async () => {
      while (queueRef.current.length > 0) {
        const currentText = queueRef.current.shift();
        if (!currentText) continue;

        isPlayingRef.current = true;
        setIsLoading(true);

        try {
          let success = false;
          
          // Try premium TTS first if enabled
          if (isPremium) {
            success = await speakWithPremiumTTS(currentText);
          }
          
          // Fallback to browser TTS
          if (!success) {
            setIsLoading(false);
            await speakWithBrowser(currentText);
          } else {
            setIsLoading(false);
          }
        } catch (error) {
          console.error("TTS error:", error);
          setIsLoading(false);
          setIsSpeaking(false);
        }
      }

      isPlayingRef.current = false;
    };

    processQueue();
  }, [enabled, isPremium, isDuplicatePhrase, speakWithPremiumTTS, speakWithBrowser, toast]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (synthRef.current) {
      synthRef.current.cancel();
    }
    setIsSpeaking(false);
    isPlayingRef.current = false;
  }, []);

  const speakInstruction = useCallback((instruction: string, distance?: string) => {
    let text = instruction;
    if (distance) {
      text = `Через ${distance}, ${instruction}`;
    }
    speak(text);
  }, [speak]);

  const speakProximityAlert = useCallback((distanceKm: number) => {
    if (distanceKm <= 0.1) {
      speak("Вы прибыли к месту назначения.");
    } else if (distanceKm <= 0.5) {
      speak("Вы почти у цели. До точки доставки менее 500 метров.");
    } else if (distanceKm <= 1) {
      speak("До точки доставки остался 1 километр.");
    } else if (distanceKm <= 5) {
      speak(`До точки доставки осталось ${Math.round(distanceKm)} километров.`);
    }
  }, [speak]);

  const setPremiumVoice = useCallback((enabled: boolean) => {
    setIsPremium(enabled);
  }, []);

  return {
    speak,
    speakInstruction,
    speakProximityAlert,
    stop,
    isSpeaking,
    isLoading,
    isPremium,
    setPremiumVoice,
    isTemporarilyDisabled: false,
  };
};
