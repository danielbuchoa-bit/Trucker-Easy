import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FoodProfile {
  diet_type: string;
  allergies: string[];
  restrictions: string[];
  health_goals: string[];
  budget_preference: string;
}

interface MenuItem {
  item_name: string;
  category: string;
  price?: number;
}

interface StationInfo {
  name: string;
  brand?: string;
  address?: string;
  placeId?: string;
  lat?: number;
  lng?: number;
}

// Cache for convenience fallback responses
const convenienceCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const { 
      profile, 
      menuItems = [], 
      placeType, 
      stopName, 
      restaurantNames = [],
      station,
      useFallback = false,
      mealType
    } = await req.json() as {
      profile: FoodProfile | null;
      menuItems: MenuItem[];
      placeType: string;
      stopName?: string;
      restaurantNames?: string[];
      station?: StationInfo;
      useFallback?: boolean;
      mealType?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Logging
    const logData = {
      stationDetected: !!station,
      stationName: station?.name || stopName,
      stationBrand: station?.brand,
      restaurantSearchAttempted: restaurantNames.length > 0 || menuItems.length > 0,
      restaurantsFound: restaurantNames.length,
      fallbackTriggered: false,
      fallbackReason: null as string | null,
      cacheHit: false,
      gptLatency: 0,
    };

    // Determine if we need convenience fallback
    const needsConvenienceFallback = useFallback || 
      (restaurantNames.length === 0 && menuItems.length === 0);
    
    if (needsConvenienceFallback && station) {
      logData.fallbackTriggered = true;
      logData.fallbackReason = useFallback ? 'explicit_request' : 'no_restaurants_found';
      
      // Check cache
      const cacheKey = station.placeId || `${station.name}_${station.lat}_${station.lng}`;
      const cached = convenienceCache.get(cacheKey);
      
      if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
        logData.cacheHit = true;
        console.log("Food recommendation log:", JSON.stringify(logData));
        return new Response(JSON.stringify(cached.data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Call GPT-5 for convenience store fallback
      const convenienceResponse = await getConvenienceFallback(
        LOVABLE_API_KEY,
        station,
        profile,
        mealType
      );
      
      logData.gptLatency = Date.now() - startTime;
      
      // Cache the response
      convenienceCache.set(cacheKey, { data: convenienceResponse, timestamp: Date.now() });
      
      console.log("Food recommendation log:", JSON.stringify(logData));
      
      return new Response(JSON.stringify(convenienceResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standard restaurant-based recommendation flow
    console.log("Request received:", { stopName, restaurantNames, menuItemsCount: menuItems.length, hasProfile: !!profile });

    const profileDescription = profile ? `
Driver Profile:
- Diet: ${profile.diet_type || 'No specific diet'}
- Allergies (HARD BLOCK - never recommend): ${profile.allergies?.length ? profile.allergies.join(', ') : 'None'}
- Restrictions: ${profile.restrictions?.length ? profile.restrictions.join(', ') : 'None'}
- Health Goals: ${profile.health_goals?.length ? profile.health_goals.join(', ') : 'None'}
- Budget: ${profile.budget_preference || 'moderate'}
` : 'No profile available - give general healthy recommendations for truck drivers.';

    let locationContext = `Stop: ${stopName || placeType}`;
    
    if (restaurantNames && restaurantNames.length > 0) {
      locationContext += `\n\nRestaurants/Food Options at this location:\n${restaurantNames.map(r => `- ${r}`).join('\n')}`;
      locationContext += `\n\nBased on these SPECIFIC restaurants available, recommend items that would typically be on their menus.`;
    } else if (menuItems.length > 0) {
      locationContext += `\n\nAvailable menu items:\n${menuItems.map(m => `- ${m.item_name} (${m.category})${m.price ? ` $${m.price}` : ''}`).join('\n')}`;
    } else {
      // This shouldn't happen if fallback logic is correct, but handle it anyway
      locationContext += `\n\nThis is a ${placeType}. Suggest typical healthy options for this type of location.`;
    }

    const systemPrompt = `You are a nutrition advisor for truck drivers. Your job is to recommend the best food choices at truck stops and rest areas.

CRITICAL RULES:
1. NEVER recommend items containing allergens from the driver's allergy list - these are hard blocks
2. Respect dietary restrictions (vegetarian, vegan, halal, kosher, etc.)
3. Consider health goals when ranking options
4. Be practical - truck drivers need quick, filling meals
5. NO medical advice, NO coordinates, NO complex nutrition science

RESPONSE FORMAT (JSON only, no markdown):
{
  "best_choice": { "item": "string", "reason": "string" },
  "alternative": { "item": "string", "reason": "string" },
  "emergency_option": { "item": "string", "reason": "string" },
  "avoid": [
    { "item": "string", "reason": "string" },
    { "item": "string", "reason": "string" }
  ]
}`;

    const userPrompt = `${profileDescription}

${locationContext}

Based on this information, recommend:
1. Best choice - the healthiest option that fits the profile from the restaurants/food options available
2. Alternative - a decent backup option
3. Emergency option - the "least bad" choice if nothing else is available
4. Avoid list - 2-3 items this driver should avoid based on their profile`;

    console.log("Calling Lovable AI for food recommendation...");

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
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI service requires credits. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let recommendation;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      recommendation = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      recommendation = {
        best_choice: { item: "Grilled chicken sandwich", reason: "Lean protein, balanced meal" },
        alternative: { item: "Turkey wrap", reason: "Lower calorie option" },
        emergency_option: { item: "Beef jerky + water", reason: "Protein without fried foods" },
        avoid: [
          { item: "Fried foods", reason: "High in saturated fat" },
          { item: "Large sodas", reason: "Empty calories and sugar" }
        ]
      };
    }

    console.log("Food recommendation generated successfully");

    return new Response(JSON.stringify(recommendation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Food recommendation error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// GPT-5 Convenience Store Fallback
async function getConvenienceFallback(
  apiKey: string,
  station: StationInfo,
  profile: FoodProfile | null,
  mealType?: string
): Promise<any> {
  const systemPrompt = `Você deve sugerir APENAS itens REALISTAS da LOJA DE CONVENIÊNCIA DO POSTO INFORMADO.
NÃO invente restaurantes.
NÃO sugira comida externa.
NÃO dependa de cardápios oficiais.

Use apenas itens comuns a conveniências de postos:
ovos cozidos, iogurte sem açúcar, queijo, nuts, frutas, saladas prontas, wraps simples, água, bebidas zero, café, proteína pronta.
Jerky apenas com alerta de sódio.

Respeite estritamente condições de saúde como diabetes/low sugar.
Evite açúcar, doces, refrigerantes normais e pães quando aplicável.
Seja específico: diga exatamente o que pegar e o que evitar.

RESPONDA APENAS EM JSON, sem markdown:
{
  "source": "CONVENIENCE_FALLBACK_GPT5",
  "station": { "name": "...", "brand": "..." },
  "best_option": {
    "title": "...",
    "why": "...",
    "what_to_pick": ["...", "..."],
    "avoid": ["..."],
    "notes": "..."
  },
  "alternatives": [
    {
      "title": "...",
      "why": "...",
      "what_to_pick": ["..."],
      "avoid": ["..."],
      "notes": "..."
    }
  ],
  "if_nothing_available": {
    "title": "...",
    "what_to_pick": ["..."],
    "notes": "..."
  },
  "avoid_list": [
    { "title": "...", "why": "..." }
  ]
}`;

  const profileInfo = profile ? `
Preferências: ${profile.diet_type || 'Nenhuma específica'}
Condições de saúde: ${profile.health_goals?.join(', ') || 'Nenhuma'}
Alergias: ${profile.allergies?.join(', ') || 'Nenhuma'}
Restrições: ${profile.restrictions?.join(', ') || 'Nenhuma'}` : 'Sem perfil - dê sugestões gerais saudáveis.';

  const userPrompt = `Posto detectado:
Nome: ${station.name}
Marca: ${station.brand || 'Desconhecida'}
Endereço: ${station.address || 'Não informado'}

Perfil do driver:
${profileInfo}
${mealType ? `\nTipo de refeição: ${mealType}` : ''}

Retorne SOMENTE o JSON solicitado com sugestões da CONVENIÊNCIA deste posto.`;

  console.log("Calling GPT-5 for convenience fallback...");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("GPT-5 convenience fallback error:", response.status, errorText);
    
    // Return a static fallback if GPT-5 fails
    return getStaticConvenienceFallback(station, profile);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    return getStaticConvenienceFallback(station, profile);
  }

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    
    // Convert to the expected format for the UI
    return {
      source: "CONVENIENCE_FALLBACK_GPT5",
      station: { name: station.name, brand: station.brand },
      best_choice: {
        item: parsed.best_option?.title || "Opção saudável da conveniência",
        reason: parsed.best_option?.why || "Melhor opção disponível",
        what_to_pick: parsed.best_option?.what_to_pick || [],
      },
      alternative: {
        item: parsed.alternatives?.[0]?.title || "Alternativa da conveniência",
        reason: parsed.alternatives?.[0]?.why || "Segunda melhor opção",
        what_to_pick: parsed.alternatives?.[0]?.what_to_pick || [],
      },
      emergency_option: {
        item: parsed.if_nothing_available?.title || "Água + nuts",
        reason: parsed.if_nothing_available?.notes || "Opção mínima segura",
        what_to_pick: parsed.if_nothing_available?.what_to_pick || [],
      },
      avoid: parsed.avoid_list?.map((a: any) => ({
        item: a.title,
        reason: a.why
      })) || [],
      is_convenience_fallback: true,
    };
  } catch (e) {
    console.error("Failed to parse GPT-5 response:", content);
    return getStaticConvenienceFallback(station, profile);
  }
}

// Static fallback if GPT-5 also fails
function getStaticConvenienceFallback(station: StationInfo, profile: FoodProfile | null): any {
  const isLowSugar = profile?.health_goals?.some(g => 
    g.toLowerCase().includes('diabetes') || 
    g.toLowerCase().includes('sugar') ||
    g.toLowerCase().includes('açúcar')
  );

  return {
    source: "CONVENIENCE_FALLBACK_STATIC",
    station: { name: station.name, brand: station.brand },
    best_choice: {
      item: isLowSugar ? "Ovos cozidos + água" : "Iogurte natural + frutas",
      reason: isLowSugar 
        ? "Proteína pura sem carboidratos, seguro para controle de açúcar" 
        : "Proteína e vitaminas, energia sustentada",
      what_to_pick: isLowSugar 
        ? ["Ovos cozidos", "Queijo em cubos", "Água mineral"]
        : ["Iogurte sem açúcar", "Banana ou maçã", "Água"],
    },
    alternative: {
      item: "Nuts + água de coco",
      reason: "Gorduras boas, minerais e hidratação",
      what_to_pick: ["Amêndoas ou castanhas sem sal", "Água de coco natural"],
    },
    emergency_option: {
      item: "Beef jerky + água (com moderação)",
      reason: "Proteína prática - ATENÇÃO: alto sódio",
      what_to_pick: ["Jerky em porção pequena", "Muita água para compensar sódio"],
    },
    avoid: [
      { item: "Refrigerantes e sucos de caixa", reason: "Alto açúcar, sem valor nutricional" },
      { item: "Salgadinhos e frituras", reason: "Gordura trans e sódio excessivo" },
      { item: "Doces e chocolates", reason: isLowSugar ? "PERIGOSO - açúcar alto" : "Calorias vazias" },
    ],
    is_convenience_fallback: true,
  };
}
