import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteData {
  origin: string;
  destination: string;
  distance_km: number;
  estimated_hours: number;
  stops_history?: Array<{
    name: string;
    type: string;
    rating?: number;
  }>;
  time_of_day?: string;
  day_of_week?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const routeData: RouteData = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Route analysis request:", routeData);

    const systemPrompt = `Você é um especialista em logística rodoviária para caminhões no Brasil.
Sua função é analisar rotas e dar recomendações práticas.

RESPONDA EM JSON com este formato:
{
  "recommended_stops": [
    { "km": number, "reason": "string", "type": "fuel|rest|food|weigh_station" }
  ],
  "best_departure_time": "string",
  "traffic_tips": ["string"],
  "fuel_strategy": "string",
  "rest_schedule": "string",
  "warnings": ["string"]
}

CONSIDERE:
- Lei do motorista: descanso obrigatório a cada 4h de direção
- Postos de pesagem obrigatórios na rota
- Horários de pico e restrições de circulação em cidades
- Economia de combustível`;

    const userPrompt = `Analise esta rota:
- Origem: ${routeData.origin}
- Destino: ${routeData.destination}
- Distância: ${routeData.distance_km} km
- Tempo estimado: ${routeData.estimated_hours} horas
${routeData.time_of_day ? `- Horário atual: ${routeData.time_of_day}` : ''}
${routeData.day_of_week ? `- Dia: ${routeData.day_of_week}` : ''}
${routeData.stops_history?.length ? `\nHistórico de paradas favoritas:\n${routeData.stops_history.map(s => `- ${s.name} (${s.type}) ${s.rating ? `★${s.rating}` : ''}`).join('\n')}` : ''}

Dê recomendações inteligentes para esta viagem.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let analysis;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      analysis = {
        recommended_stops: [],
        best_departure_time: "Não foi possível calcular",
        traffic_tips: ["Verifique condições locais"],
        fuel_strategy: "Abasteça em postos de rede conhecida",
        rest_schedule: "Faça pausas a cada 4 horas",
        warnings: []
      };
    }

    console.log("Route analysis completed");

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Route analysis error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
