import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Review {
  rating: number;
  comment?: string;
  created_at: string;
  tags?: string[];
}

interface SummaryRequest {
  place_name: string;
  place_type: string;
  reviews: Review[];
  avg_rating?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { place_name, place_type, reviews, avg_rating }: SummaryRequest = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!reviews || reviews.length === 0) {
      return new Response(JSON.stringify({
        summary: "Ainda não há avaliações suficientes para gerar um resumo.",
        highlights: [],
        concerns: [],
        best_for: null
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Review summary request:", { place_name, reviewCount: reviews.length });

    const systemPrompt = `Você resume avaliações de locais para motoristas de caminhão.
Analise os comentários e extraia informações úteis.

RESPONDA EM JSON:
{
  "summary": "Resumo de 2-3 frases sobre o local",
  "highlights": ["Pontos positivos mencionados"],
  "concerns": ["Pontos negativos ou alertas"],
  "best_for": "Tipo de parada ideal (descanso/refeição/combustível/etc)" ou null,
  "trucker_rating": "Excelente/Bom/Regular/Ruim",
  "recent_trend": "melhorando/estável/piorando" ou null
}

Foque em informações relevantes para caminhoneiros:
- Estacionamento para carretas
- Segurança do local
- Qualidade da comida
- Atendimento
- Preços
- Banheiros
- Tempo de espera`;

    const reviewsText = reviews
      .filter(r => r.comment)
      .slice(0, 20) // Limit to 20 most recent
      .map(r => `[★${r.rating}] ${r.comment}${r.tags?.length ? ` (Tags: ${r.tags.join(', ')})` : ''}`)
      .join('\n');

    const userPrompt = `Local: ${place_name} (${place_type})
Nota média: ${avg_rating?.toFixed(1) || 'N/A'}
Total de avaliações: ${reviews.length}

Avaliações recentes:
${reviewsText || 'Sem comentários detalhados'}

Gere um resumo útil para motoristas.`;

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
        temperature: 0.5,
        max_tokens: 800,
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

    let summary;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      summary = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      summary = {
        summary: "Resumo não disponível no momento.",
        highlights: [],
        concerns: [],
        best_for: null,
        trucker_rating: "Não avaliado",
        recent_trend: null
      };
    }

    console.log("Review summary generated");

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Review summary error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
