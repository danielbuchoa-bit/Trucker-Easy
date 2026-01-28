import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VoiceCommand {
  transcript: string;
  language?: 'en' | 'es' | 'pt';
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
    const { transcript, language = 'en', context }: VoiceCommand = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Voice command received:", transcript, "language:", language);

    // Language-specific prompts
    const getSystemPrompt = (lang: string) => {
      if (lang === 'pt') {
        return `Você interpreta comandos de voz de motoristas de caminhão e retorna ações estruturadas.

COMANDOS SUPORTADOS:
- Navegação: "ir para", "navegar até", "rota para"
- Busca: "encontrar", "procurar", "onde fica"
- Report: "reportar", "avisar", "tem"
- Informação: "quanto tempo", "distância", "próximo"

RESPONDA EM JSON:
{
  "action": "navigate|search|report|info|chat",
  "parameters": {
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
      } else if (lang === 'es') {
        return `Interpretas comandos de voz de conductores de camiones y devuelves acciones estructuradas.

COMANDOS SOPORTADOS:
- Navegación: "ir a", "navegar a", "ruta hacia"
- Búsqueda: "encontrar", "buscar", "dónde está"
- Reporte: "reportar", "avisar", "hay"
- Información: "cuánto tiempo", "distancia", "próximo"

RESPONDE EN JSON:
{
  "action": "navigate|search|report|info|chat",
  "parameters": {
    // navigate: { destination: "string" }
    // search: { query: "string", type: "fuel|food|rest|weigh_station" }
    // report: { type: "accident|traffic|police|road_condition", details: "string" }
    // info: { query: "string" }
    // chat: { message: "string" }
  },
  "confirmation": "Frase corta para confirmar el comando al conductor",
  "confidence": 0.0-1.0
}

Si no entiendes el comando, usa action: "chat" y responde normalmente.`;
      } else {
        return `You interpret voice commands from truck drivers and return structured actions.

SUPPORTED COMMANDS:
- Navigation: "go to", "navigate to", "route to"
- Search: "find", "search for", "where is"
- Report: "report", "alert", "there is"
- Information: "how long", "distance", "next"

RESPOND IN JSON:
{
  "action": "navigate|search|report|info|chat",
  "parameters": {
    // navigate: { destination: "string" }
    // search: { query: "string", type: "fuel|food|rest|weigh_station" }
    // report: { type: "accident|traffic|police|road_condition", details: "string" }
    // info: { query: "string" }
    // chat: { message: "string" }
  },
  "confirmation": "Short phrase to confirm the command to the driver",
  "confidence": 0.0-1.0
}

If you don't understand the command, use action: "chat" and respond normally.`;
      }
    };

    const systemPrompt = getSystemPrompt(language);

    const getContextText = (lang: string, isNavigating: boolean) => {
      if (lang === 'pt') {
        return isNavigating ? 'Contexto: Motorista está em navegação ativa' : '';
      } else if (lang === 'es') {
        return isNavigating ? 'Contexto: Conductor está en navegación activa' : '';
      } else {
        return isNavigating ? 'Context: Driver is in active navigation' : '';
      }
    };

    const userPrompt = `${language === 'pt' ? 'Comando de voz' : language === 'es' ? 'Comando de voz' : 'Voice command'}: "${transcript}"
${getContextText(language, context?.current_route || false)}`;

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
      const fallbackMessages = {
        pt: { message: "Desculpe, não entendi o comando. Pode repetir?", confirmation: "Não entendi. Tente novamente." },
        es: { message: "Lo siento, no entendí el comando. ¿Puedes repetir?", confirmation: "No entendí. Intenta de nuevo." },
        en: { message: "Sorry, I didn't understand the command. Can you repeat?", confirmation: "I didn't understand. Try again." }
      };
      const fallback = fallbackMessages[language] || fallbackMessages.en;
      command = {
        action: "chat",
        parameters: { message: fallback.message },
        confirmation: fallback.confirmation,
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
