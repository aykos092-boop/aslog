import { useCallback, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface VoiceNavigationOptions {
  enabled?: boolean;
  language?: string;
}

// Constants for rate limiting and circuit breaker
const MAX_QUEUE_SIZE = 3;
const PHRASE_COOLDOWN_MS = 15000; // 15 seconds between identical phrases
const MAX_CONSECUTIVE_ERRORS = 2;
const DISABLE_DURATION_MS = 60000; // 1 minute pause after errors

export const useVoiceNavigation = (options: VoiceNavigationOptions = {}) => {
  const { enabled = true, language = "ru" } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isTemporarilyDisabled, setIsTemporarilyDisabled] = useState(false);
  const { toast } = useToast();
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);
  const recentPhrasesRef = useRef<Map<string, number>>(new Map());
  const consecutiveErrorsRef = useRef<number>(0);
  const ttsDisabledUntilRef = useRef<number>(0);
  const toastShownRef = useRef(false);

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

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text) return;

    // Check if TTS is temporarily disabled after errors
    const now = Date.now();
    if (now < ttsDisabledUntilRef.current) {
      return;
    }
    
    // Re-enable if cooldown passed
    if (isTemporarilyDisabled && now >= ttsDisabledUntilRef.current) {
      setIsTemporarilyDisabled(false);
      consecutiveErrorsRef.current = 0;
      toastShownRef.current = false;
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

        // Double-check disabled state
        if (Date.now() < ttsDisabledUntilRef.current) {
          queueRef.current = [];
          break;
        }

        isPlayingRef.current = true;
        setIsLoading(true);

        try {
          const response = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/navigation-tts`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              },
              body: JSON.stringify({ text: currentText, language }),
            }
          );

          // Graceful handling for 401/429/5xx - don't crash the app
          if (!response.ok) {
            const status = response.status;
            consecutiveErrorsRef.current++;

            if (status === 401 || status === 429 || status >= 500) {
              // Expected provider errors - handle gracefully
              if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS) {
                ttsDisabledUntilRef.current = Date.now() + DISABLE_DURATION_MS;
                queueRef.current = [];
                setIsTemporarilyDisabled(true);

                // Show toast only once
                if (!toastShownRef.current) {
                  toastShownRef.current = true;
                  toast({
                    title: "Голос временно недоступен",
                    description: "Навигация продолжается без озвучки",
                  });
                }
              }
              
              setIsLoading(false);
              continue; // Skip to next phrase
            }
            
            setIsLoading(false);
            continue;
          }

          // Success - reset error counter
          consecutiveErrorsRef.current = 0;

          const data = await response.json();
          
          if (data.audioContent) {
            const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
            
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }

            const audio = new Audio(audioUrl);
            audioRef.current = audio;
            
            setIsLoading(false);
            setIsSpeaking(true);

            await new Promise<void>((resolve) => {
              audio.onended = () => {
                setIsSpeaking(false);
                resolve();
              };
              audio.onerror = () => {
                setIsSpeaking(false);
                resolve();
              };
              audio.play().catch(() => {
                setIsSpeaking(false);
                resolve();
              });
            });
          } else {
            setIsLoading(false);
          }
        } catch (error) {
          // Network errors - handle gracefully
          consecutiveErrorsRef.current++;
          
          if (consecutiveErrorsRef.current >= MAX_CONSECUTIVE_ERRORS && !toastShownRef.current) {
            ttsDisabledUntilRef.current = Date.now() + DISABLE_DURATION_MS;
            queueRef.current = [];
            setIsTemporarilyDisabled(true);
            toastShownRef.current = true;
            
            toast({
              title: "Голос временно недоступен",
              description: "Навигация продолжается без озвучки",
            });
          }
          
          setIsLoading(false);
          setIsSpeaking(false);
        }
      }

      isPlayingRef.current = false;
    };

    processQueue();
  }, [enabled, language, isDuplicatePhrase, isTemporarilyDisabled, toast]);

  const stop = useCallback(() => {
    queueRef.current = [];
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
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
    if (distanceKm <= 0.5) {
      speak("Вы почти у цели. До точки доставки менее 500 метров.");
    } else if (distanceKm <= 1) {
      speak("До точки доставки остался 1 километр.");
    } else if (distanceKm <= 5) {
      speak(`До точки доставки осталось ${Math.round(distanceKm)} километров.`);
    }
  }, [speak]);

  return {
    speak,
    speakInstruction,
    speakProximityAlert,
    stop,
    isSpeaking,
    isLoading,
    isTemporarilyDisabled,
  };
};
