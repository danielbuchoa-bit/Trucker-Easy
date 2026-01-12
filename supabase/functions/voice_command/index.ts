import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoiceCommand {
  transcript: string;
  context?: {
    current_route?: boolean;
    location?: { lat: number; lng: number };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { transcript, context }: VoiceCommand = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Voice command received:", transcript);

    const systemPrompt = `Você interpreta comandos de voz de motoristas de caminhão e retorna ações estruturadas.

COMANDOS SUPORTADOS:
- Navegação: "ir para", "navegar até", "rota para"
- Busca: "encontrar", "procurar", "onde fica"
- Report: "reportar", "avisar", "tem"
- Informação: "quanto tempo", "distância", "próximo"

RESPONDA EM JSON:
{
  "action": "navigate|search|report|info|chat",
  "parameters": {
    // Depende da ação:
    // navigate: { destination: "string" }
    // search: { query: "string", type: "fuel|food|rest|weigh_station" }
    // report: { type: "accident|traffic|police|road_condition", details: "string" }
    // info: { query: "string" }
    // chat: { message: "string" }
  },
  "confirmation": "Frase curta para confirmar o comando ao motorista",
  "confidence": 0.0-1.0
}

Se não entender o comando, use action: "chat" e responda normalmente.`;

    const userPrompt = `Comando de voz: "${transcript}"
${context?.current_route ? 'Contexto: Motorista está em navegação ativa' : ''}`;

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
        temperature: 0.3,
        max_tokens: 500,
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

    let command;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      command = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      command = {
        action: "chat",
        parameters: { message: "Desculpe, não entendi o comando. Pode repetir?" },
        confirmation: "Não entendi. Tente novamente.",
        confidence: 0.3
      };
    }

    console.log("Voice command processed:", command.action);

    return new Response(JSON.stringify(command), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Voice command error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
