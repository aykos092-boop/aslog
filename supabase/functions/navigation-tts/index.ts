import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, language = "ru", premium = false, gender = "male" } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text: "", language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("TTS request:", { text: text.substring(0, 50), language, premium, gender });

    // If not premium, use browser TTS
    if (!premium) {
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text, language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!apiKey) {
      console.log("No Google API key, falling back to browser TTS");
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text, language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Voice selection based on language and gender
    const voiceMap: Record<string, Record<string, string>> = {
      ru: { 
        male: "ru-RU-Wavenet-D",
        female: "ru-RU-Wavenet-E"
      },
      en: { 
        male: "en-US-Wavenet-D",
        female: "en-US-Wavenet-F"
      },
      uz: {
        male: "uz-UZ-Standard-A",
        female: "uz-UZ-Standard-A"
      }
    };

    const languageCode = language === "ru" ? "ru-RU" : language === "uz" ? "uz-UZ" : "en-US";
    const voiceName = voiceMap[language]?.[gender] || voiceMap["ru"]["male"];

    console.log("Calling Google TTS with voice:", voiceName);

    const ttsResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode,
            name: voiceName,
            ssmlGender: gender === "female" ? "FEMALE" : "MALE"
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.05,
            pitch: 0,
            volumeGainDb: 2.0
          }
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("Google TTS error:", ttsResponse.status, errorText);
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text, language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttsData = await ttsResponse.json();

    if (ttsData.audioContent) {
      console.log("Google TTS success, returning MP3 audio");
      return new Response(
        JSON.stringify({ 
          audioContent: ttsData.audioContent, 
          premium: true,
          format: "mp3"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("No audio content, falling back to browser TTS");
    return new Response(
      JSON.stringify({ useBrowserTTS: true, text, language }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("TTS error:", error);
    return new Response(
      JSON.stringify({ useBrowserTTS: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
