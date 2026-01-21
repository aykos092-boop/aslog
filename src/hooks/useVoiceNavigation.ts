import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface VoiceNavigationOptions {
  enabled?: boolean;
  language?: string;
}

export const useVoiceNavigation = (options: VoiceNavigationOptions = {}) => {
  const { enabled = true, language = "ru" } = options;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queueRef = useRef<string[]>([]);
  const isPlayingRef = useRef(false);

  const speak = useCallback(async (text: string) => {
    if (!enabled || !text) return;

    // Add to queue
    queueRef.current.push(text);
    
    // If already playing, the queue will be processed
    if (isPlayingRef.current) return;

    const processQueue = async () => {
      while (queueRef.current.length > 0) {
        const currentText = queueRef.current.shift();
        if (!currentText) continue;

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

          if (!response.ok) {
            throw new Error(`TTS request failed: ${response.status}`);
          }

          const data = await response.json();
          
          if (data.audioContent) {
            const audioUrl = `data:audio/mpeg;base64,${data.audioContent}`;
            
            // Stop previous audio if playing
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
          }
        } catch (error) {
          console.error("Voice navigation error:", error);
          setIsLoading(false);
          setIsSpeaking(false);
        }
      }

      isPlayingRef.current = false;
    };

    processQueue();
  }, [enabled, language]);

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
  };
};
