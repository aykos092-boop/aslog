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
    const { text, language = "ru", premium = false } = await req.json();

    if (!text) {
      return new Response(
        JSON.stringify({ error: "Text is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("TTS request:", { text: text.substring(0, 50), language, premium });

    // If not premium, instruct to use browser TTS
    if (!premium) {
      return new Response(
        JSON.stringify({ 
          useBrowserTTS: true,
          text,
          language,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Premium TTS using Google Cloud Text-to-Speech
    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!apiKey) {
      console.log("No API key, falling back to browser TTS");
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text, language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Select voice based on language
    const voiceName = language === "ru" ? "ru-RU-Wavenet-D" : "en-US-Wavenet-D";
    const languageCode = language === "ru" ? "ru-RU" : "en-US";

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
            ssmlGender: "MALE",
          },
          audioConfig: {
            audioEncoding: "MP3",
            speakingRate: 1.1,
            pitch: 0,
            volumeGainDb: 3.0,
          },
        }),
      }
    );

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error("Google TTS error:", ttsResponse.status, errorText);
      
      // Fallback to browser TTS on any error
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text, language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ttsData = await ttsResponse.json();

    if (!ttsData.audioContent) {
      console.log("No audio content, falling back to browser TTS");
      return new Response(
        JSON.stringify({ useBrowserTTS: true, text, language }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Premium TTS generated successfully");

    return new Response(
      JSON.stringify({ 
        audioContent: ttsData.audioContent,
        premium: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in navigation-tts:", errorMessage);
    
    // Always fallback to browser TTS on error
    return new Response(
      JSON.stringify({ useBrowserTTS: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
