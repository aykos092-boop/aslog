import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const getSystemPrompt = (carriersContext: string) => `Ты — умный AI-ассистент платформы грузоперевозок "ГрузоТакси". 
Ты помогаешь клиентам:
1. Выбрать подходящего перевозчика на основе их требований
2. Рассчитать примерную стоимость доставки
3. Ответить на вопросы о процессе доставки
4. Рекомендовать лучших перевозчиков по рейтингу

Правила расчёта стоимости:
- Базовая ставка: 500 рублей
- За километр: 25 рублей
- За килограмм: 3 рубля
- Срочная доставка: +50% к стоимости
- Скидка за объём (более 1000 кг): -15%

Типы перевозчиков:
- Частные водители (driver): гибкий график, личный подход, подходят для небольших грузов
- Транспортные компании (company): надёжность, страховка, подходят для крупных грузов

При расчёте стоимости всегда уточняй:
- Расстояние (км)
- Вес груза (кг)
- Срочность доставки
- Тип груза

${carriersContext}

Отвечай кратко, дружелюбно и по делу. Используй эмодзи умеренно.
Когда пользователь спрашивает о рекомендациях перевозчиков, используй реальные данные о перевозчиках выше.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Processing AI request with", messages.length, "messages");

    // Fetch top carriers with ratings for context
    let carriersContext = "";
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get carriers with their profiles and average ratings
      const { data: carriers } = await supabase
        .from("profiles")
        .select(`
          user_id,
          full_name,
          carrier_type,
          vehicle_type,
          company_name,
          is_verified
        `)
        .not("carrier_type", "is", null);

      if (carriers && carriers.length > 0) {
        // Get ratings for all carriers
        const carrierIds = carriers.map(c => c.user_id);
        const { data: ratings } = await supabase
          .from("ratings")
          .select("rated_id, score")
          .in("rated_id", carrierIds);

        // Calculate average ratings
        const ratingMap = new Map<string, { total: number; count: number }>();
        ratings?.forEach(r => {
          const existing = ratingMap.get(r.rated_id) || { total: 0, count: 0 };
          ratingMap.set(r.rated_id, {
            total: existing.total + r.score,
            count: existing.count + 1,
          });
        });

        // Get completed deals count
        const { data: deals } = await supabase
          .from("deals")
          .select("carrier_id")
          .eq("status", "delivered")
          .in("carrier_id", carrierIds);

        const dealsMap = new Map<string, number>();
        deals?.forEach(d => {
          dealsMap.set(d.carrier_id, (dealsMap.get(d.carrier_id) || 0) + 1);
        });

        // Build context with carrier info
        const carriersList = carriers.map(c => {
          const rating = ratingMap.get(c.user_id);
          const avgRating = rating ? (rating.total / rating.count).toFixed(1) : "нет оценок";
          const dealsCount = dealsMap.get(c.user_id) || 0;
          const verified = c.is_verified ? "✓ верифицирован" : "";
          const type = c.carrier_type === "company" ? "Компания" : "Водитель";
          const name = c.company_name || c.full_name || "Без имени";
          
          return `- ${name} (${type}): рейтинг ${avgRating}, ${dealsCount} выполненных заказов ${verified}`;
        }).join("\n");

        if (carriersList) {
          carriersContext = `\nАКТУАЛЬНЫЕ ПЕРЕВОЗЧИКИ НА ПЛАТФОРМЕ:\n${carriersList}\n`;
        }
      }
    }

    const systemPrompt = getSystemPrompt(carriersContext);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Превышен лимит запросов. Попробуйте позже." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Требуется пополнение баланса AI." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Ошибка AI сервиса" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("AI assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
