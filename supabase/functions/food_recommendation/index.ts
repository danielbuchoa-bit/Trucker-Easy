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

// CRITICAL: Cache REMOVED to ensure contextual, varied recommendations
// Each request now generates fresh AI recommendations based on:
// - Current station detected
// - Driver's food profile
// - Time of day (meal type)
// - Available restaurants

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
      mealType,
      language = 'en'
    } = await req.json() as {
      profile: FoodProfile | null;
      menuItems: MenuItem[];
      placeType: string;
      stopName?: string;
      restaurantNames?: string[];
      station?: StationInfo;
      useFallback?: boolean;
      mealType?: string;
      language?: string;
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Generate unique request ID for logging
    const requestId = crypto.randomUUID().slice(0, 8);
    
    // Detect meal type based on current time if not provided
    const currentHour = new Date().getHours();
    const detectedMealType = mealType || getMealTypeFromHour(currentHour, language);

    // DETAILED LOGGING - Required for debugging
    const logData = {
      requestId,
      timestamp: new Date().toISOString(),
      stationDetected: !!station,
      stationName: station?.name || stopName,
      stationBrand: station?.brand || 'unknown',
      stationAddress: station?.address || 'unknown',
      stationLat: station?.lat,
      stationLng: station?.lng,
      restaurantSearchAttempted: true,
      restaurantsFound: restaurantNames.length,
      restaurantNames: restaurantNames.slice(0, 5),
      menuItemsCount: menuItems.length,
      fallbackTriggered: false,
      fallbackReason: null as string | null,
      gptModel: 'n/a',
      gptLatency: 0,
      mealType: detectedMealType,
      hasProfile: !!profile,
      profileSummary: profile ? {
        diet: profile.diet_type || 'none',
        allergiesCount: profile.allergies?.length || 0,
        healthGoals: profile.health_goals?.slice(0, 3) || [],
      } : null,
    };

    // Determine if we need convenience fallback
    const needsConvenienceFallback = useFallback || 
      (restaurantNames.length === 0 && menuItems.length === 0);
    
    if (needsConvenienceFallback && station) {
      logData.fallbackTriggered = true;
      logData.fallbackReason = useFallback ? 'explicit_request' : 'no_restaurants_found';
      logData.gptModel = 'openai/gpt-5';

      console.log(`[FOOD_REC:${requestId}] === CONVENIENCE FALLBACK TRIGGERED ===`);
      console.log(`[FOOD_REC:${requestId}] Station: ${station.name} (${station.brand || 'unknown brand'})`);
      console.log(`[FOOD_REC:${requestId}] Reason: ${logData.fallbackReason}`);
      console.log(`[FOOD_REC:${requestId}] Profile: ${profile ? 'yes' : 'no'}`);

      // NO CACHE - Always generate fresh contextual recommendations
      const convenienceResponse = await getConvenienceFallback(
        LOVABLE_API_KEY,
        station,
        profile,
        detectedMealType,
        requestId,
        language
      );
      
      logData.gptLatency = Date.now() - startTime;
      
      console.log(`[FOOD_REC:${requestId}] === LOG DATA ===`);
      console.log(JSON.stringify(logData, null, 2));
      console.log(`[FOOD_REC:${requestId}] Suggestions generated:`, {
        bestChoice: convenienceResponse.best_choice?.item,
        alternative: convenienceResponse.alternative?.item,
        source: convenienceResponse.source,
      });
      
      return new Response(JSON.stringify(convenienceResponse), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Standard restaurant-based recommendation flow
    logData.gptModel = 'google/gemini-3-flash-preview';
    
    console.log(`[FOOD_REC:${requestId}] === RESTAURANT-BASED RECOMMENDATION ===`);
    console.log(`[FOOD_REC:${requestId}] Stop: ${stopName || station?.name}`);
    console.log(`[FOOD_REC:${requestId}] Restaurants found: ${restaurantNames.length}`);
    console.log(`[FOOD_REC:${requestId}] Restaurants: ${restaurantNames.slice(0, 5).join(', ')}`);

    const profileDescription = profile ? `
Driver Profile:
- Diet: ${profile.diet_type || 'No specific diet'}
- Allergies (CRITICAL - NEVER recommend): ${profile.allergies?.length ? profile.allergies.join(', ') : 'None'}
- Restrictions: ${profile.restrictions?.length ? profile.restrictions.join(', ') : 'None'}
- Health Goals: ${profile.health_goals?.length ? profile.health_goals.join(', ') : 'None'}
- Budget: ${profile.budget_preference || 'moderate'}
` : 'No profile available - give general healthy recommendations for truck drivers.';

    // Build context with SPECIFIC location info
    let locationContext = `
CURRENT STOP:
- Name: ${stopName || station?.name || placeType}
- Type: ${placeType}
- Brand: ${station?.brand || 'Unknown'}
- Address: ${station?.address || 'Not available'}
- Meal Time: ${detectedMealType}
`;
    
    if (restaurantNames && restaurantNames.length > 0) {
      locationContext += `
RESTAURANTS/FOOD OPTIONS AT THIS SPECIFIC LOCATION:
${restaurantNames.map(r => `- ${r}`).join('\n')}

CRITICAL: Base your recommendations on these SPECIFIC restaurants. 
Suggest ACTUAL menu items that would realistically be available at these restaurants.
DO NOT give generic suggestions - tailor them to these specific establishments.
`;
    } else if (menuItems.length > 0) {
      locationContext += `
AVAILABLE MENU ITEMS:
${menuItems.map(m => `- ${m.item_name} (${m.category})${m.price ? ` $${m.price}` : ''}`).join('\n')}
`;
    }

    const systemPrompt = `You are a nutrition advisor for truck drivers. Your job is to recommend the BEST food choices at THIS SPECIFIC truck stop.

CRITICAL RULES:
1. NEVER recommend items containing allergens from the driver's allergy list - these are HARD BLOCKS
2. Respect dietary restrictions (vegetarian, vegan, halal, kosher, etc.)
3. Consider health goals when ranking options (especially low-sugar, diabetes, heart health)
4. Be practical - truck drivers need quick, filling meals
5. Recommendations must be SPECIFIC to this location - use restaurant names when available
6. Consider the meal time (${detectedMealType}) for appropriate suggestions
7. NO generic advice - be specific and actionable

RESPONSE FORMAT (JSON only, no markdown):
{
  "best_choice": { "item": "string - specific menu item with restaurant name if known", "reason": "string - why this fits the driver's profile" },
  "alternative": { "item": "string - different option from a different restaurant if possible", "reason": "string" },
  "emergency_option": { "item": "string - fallback if main options unavailable", "reason": "string" },
  "avoid": [
    { "item": "string", "reason": "string - specific reason for THIS driver" },
    { "item": "string", "reason": "string" }
  ]
}`;

    const userPrompt = `${profileDescription}

${locationContext}

Based on this SPECIFIC location and the driver's profile, recommend:
1. Best choice - the healthiest option that fits the profile from the restaurants/food options at THIS stop
2. Alternative - a decent backup option (preferably from a different restaurant if multiple are available)
3. Emergency option - what to get if nothing else is available
4. Avoid list - 2-3 specific items this driver should avoid based on their profile`;

    console.log(`[FOOD_REC:${requestId}] Calling Gemini for restaurant recommendations...`);

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
        temperature: 0.8, // Increased for more variety
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error(`[FOOD_REC:${requestId}] Rate limit exceeded`);
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        console.error(`[FOOD_REC:${requestId}] Payment required`);
        return new Response(JSON.stringify({ error: "AI service requires credits. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error(`[FOOD_REC:${requestId}] AI gateway error:`, response.status, errorText);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    logData.gptLatency = Date.now() - startTime;

    let recommendation;
    try {
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      recommendation = JSON.parse(cleanContent);
      recommendation.source = "RESTAURANT_BASED";
      recommendation.station = { name: station?.name || stopName, brand: station?.brand };
      recommendation.is_convenience_fallback = false;
    } catch {
      console.error(`[FOOD_REC:${requestId}] Failed to parse AI response:`, content);
      // Generate contextual fallback based on restaurants
      recommendation = getRestaurantFallback(restaurantNames, profile, detectedMealType);
    }

    console.log(`[FOOD_REC:${requestId}] === LOG DATA ===`);
    console.log(JSON.stringify(logData, null, 2));
    console.log(`[FOOD_REC:${requestId}] Suggestions generated:`, {
      bestChoice: recommendation.best_choice?.item,
      alternative: recommendation.alternative?.item,
      source: recommendation.source,
    });

    return new Response(JSON.stringify(recommendation), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[FOOD_REC] Critical error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Detect meal type from hour - language aware
function getMealTypeFromHour(hour: number, language: string = 'en'): string {
  const mealTypes = {
    en: { breakfast: 'breakfast', lunch: 'lunch', afternoon: 'afternoon snack', dinner: 'dinner', night: 'late night snack' },
    es: { breakfast: 'desayuno', lunch: 'almuerzo', afternoon: 'merienda', dinner: 'cena', night: 'snack nocturno' },
    pt: { breakfast: 'café da manhã', lunch: 'almoço', afternoon: 'lanche da tarde', dinner: 'jantar', night: 'lanche noturno' },
  };
  
  const lang = mealTypes[language as keyof typeof mealTypes] || mealTypes.en;
  
  if (hour >= 5 && hour < 11) return lang.breakfast;
  if (hour >= 11 && hour < 15) return lang.lunch;
  if (hour >= 15 && hour < 18) return lang.afternoon;
  if (hour >= 18 && hour < 22) return lang.dinner;
  return lang.night;
}

// Generate restaurant-based fallback when AI parsing fails
function getRestaurantFallback(restaurants: string[], profile: FoodProfile | null, mealType: string): any {
  const isLowSugar = profile?.health_goals?.some(g => 
    g.toLowerCase().includes('diabetes') || 
    g.toLowerCase().includes('sugar') ||
    g.toLowerCase().includes('açúcar')
  );
  
  const firstRestaurant = restaurants[0] || 'restaurante local';
  const secondRestaurant = restaurants[1] || restaurants[0] || 'alternativa';
  
  const breakfastOptions = isLowSugar
    ? { best: "Ovos mexidos com bacon", alt: "Omelete de queijo" }
    : { best: "Panquecas com ovos", alt: "French toast combo" };
    
  const lunchOptions = isLowSugar
    ? { best: "Frango grelhado com salada", alt: "Steak com vegetais" }
    : { best: "Burger com salada", alt: "Wrap de frango" };
    
  const dinnerOptions = isLowSugar
    ? { best: "Salmão grelhado", alt: "Peito de frango" }
    : { best: "Steak dinner", alt: "Pasta primavera" };

  let options;
  if (mealType.includes('café') || mealType.includes('manhã')) {
    options = breakfastOptions;
  } else if (mealType.includes('almoço')) {
    options = lunchOptions;
  } else {
    options = dinnerOptions;
  }

  return {
    source: "RESTAURANT_FALLBACK",
    is_convenience_fallback: false,
    best_choice: {
      item: `${options.best} no ${firstRestaurant}`,
      reason: isLowSugar 
        ? "Baixo carboidrato, adequado para controle glicêmico" 
        : "Proteína e energia para a estrada",
    },
    alternative: {
      item: `${options.alt} no ${secondRestaurant}`,
      reason: "Segunda melhor opção disponível",
    },
    emergency_option: {
      item: "Salada com proteína grelhada",
      reason: "Sempre uma opção segura",
    },
    avoid: [
      { item: "Frituras pesadas", reason: isLowSugar ? "Alto índice glicêmico" : "Digestão difícil na estrada" },
      { item: "Refrigerantes", reason: isLowSugar ? "PERIGOSO - açúcar alto" : "Calorias vazias" },
    ],
  };
}

// GPT-5 Convenience Store Fallback - NO CACHE, always fresh
async function getConvenienceFallback(
  apiKey: string,
  station: StationInfo,
  profile: FoodProfile | null,
  mealType: string,
  requestId: string,
  language: string = 'en'
): Promise<any> {
  
  // Language-specific prompts
  const prompts = getLanguagePrompts(language, station, mealType, profile);
  
  // Build highly contextual prompt with station specifics
  const stationContext = prompts.stationContext;

  const brandSpecificItems = getBrandSpecificItems(station.brand, language);

  const systemPrompt = prompts.systemPrompt.replace('{{BRAND_ITEMS}}', brandSpecificItems);

  const profileInfo = profile ? prompts.profileWithData
    .replace('{{DIET}}', profile.diet_type || prompts.noSpecificDiet)
    .replace('{{ALLERGIES}}', profile.allergies?.join(', ') || prompts.none)
    .replace('{{RESTRICTIONS}}', profile.restrictions?.join(', ') || prompts.none)
    .replace('{{HEALTH_GOALS}}', profile.health_goals?.join(', ') || prompts.none)
    .replace('{{BUDGET}}', profile.budget_preference || 'moderate')
    : prompts.noProfile;

  const userPrompt = `${stationContext}

${profileInfo}

${prompts.mealTime}: ${mealType}

${prompts.generateSpecific}`;

  console.log(`[FOOD_REC:${requestId}] Calling GPT-5 for convenience fallback (lang: ${language})...`);
  console.log(`[FOOD_REC:${requestId}] Station: ${station.name}, Brand: ${station.brand}, Meal: ${mealType}`);

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
      temperature: 0.9,
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FOOD_REC:${requestId}] GPT-5 error:`, response.status, errorText);
    
    // Return contextual static fallback if GPT-5 fails
    return getStaticConvenienceFallback(station, profile, mealType, language);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error(`[FOOD_REC:${requestId}] No content in GPT-5 response`);
    return getStaticConvenienceFallback(station, profile, mealType, language);
  }

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    
    console.log(`[FOOD_REC:${requestId}] GPT-5 response parsed successfully`);
    
    const fallbackTexts = getStaticFallbackTexts(language);
    
    // Convert to the expected format for the UI
    return {
      source: "CONVENIENCE_FALLBACK_GPT5",
      station: { name: station.name, brand: station.brand },
      best_choice: {
        item: parsed.best_option?.title || fallbackTexts.healthyOption,
        reason: parsed.best_option?.why || fallbackTexts.bestAvailable,
        what_to_pick: parsed.best_option?.what_to_pick || [],
      },
      alternative: {
        item: parsed.alternatives?.[0]?.title || fallbackTexts.alternativeOption,
        reason: parsed.alternatives?.[0]?.why || fallbackTexts.secondBest,
        what_to_pick: parsed.alternatives?.[0]?.what_to_pick || [],
      },
      emergency_option: {
        item: parsed.if_nothing_available?.title || fallbackTexts.waterNuts,
        reason: parsed.if_nothing_available?.notes || fallbackTexts.minSafe,
        what_to_pick: parsed.if_nothing_available?.what_to_pick || [],
      },
      avoid: parsed.avoid_list?.map((a: any) => ({
        item: a.title,
        reason: a.why
      })) || [],
      is_convenience_fallback: true,
    };
  } catch (e) {
    console.error(`[FOOD_REC:${requestId}] Failed to parse GPT-5 response:`, content);
    return getStaticConvenienceFallback(station, profile, mealType, language);
  }
}

// Get language-specific prompts
function getLanguagePrompts(language: string, station: StationInfo, mealType: string, profile: FoodProfile | null) {
  const hasSugarRestriction = profile?.health_goals?.some(g => 
    g.toLowerCase().includes('diabetes') || g.toLowerCase().includes('sugar') || g.toLowerCase().includes('açúcar')
  );
  
  if (language === 'pt') {
    return {
      stationContext: `POSTO DETECTADO:\n- Nome: ${station.name}\n- Marca/Rede: ${station.brand || 'Posto independente'}\n- Endereço: ${station.address || 'Não disponível'}\n- Coordenadas: ${station.lat}, ${station.lng}`,
      systemPrompt: `Você é um nutricionista especializado em alimentação para caminhoneiros.\nO motorista está NESTE EXATO POSTO: ${station.name} (${station.brand || 'independente'}).\n\nNÃO há restaurante identificado neste posto. Você DEVE sugerir APENAS itens da LOJA DE CONVENIÊNCIA.\n\nREGRAS CRÍTICAS:\n1. Sugira APENAS itens realistas de conveniência: {{BRAND_ITEMS}}\n2. NÃO invente restaurantes ou comidas que não existem em conveniências\n3. Considere o horário atual (${mealType})\n4. Respeite ESTRITAMENTE alergias e condições de saúde\n5. Seja ESPECÍFICO - nomes de produtos reais quando possível\n\n${hasSugarRestriction ? 'ATENÇÃO: Este motorista tem RESTRIÇÃO DE AÇÚCAR. EVITE todos produtos com açúcar.' : ''}\n\nFORMATO DE RESPOSTA (JSON puro):\n{\n  "source": "CONVENIENCE_FALLBACK_GPT5",\n  "station": { "name": "${station.name}", "brand": "${station.brand || 'independente'}" },\n  "best_option": {\n    "title": "Nome da sugestão",\n    "why": "Por que é a melhor opção para este motorista",\n    "what_to_pick": ["item1", "item2", "item3"],\n    "notes": "Dica adicional"\n  },\n  "alternatives": [{\n    "title": "Alternativa",\n    "why": "Razão",\n    "what_to_pick": ["item1"],\n    "notes": "Dica"\n  }],\n  "if_nothing_available": {\n    "title": "Emergência",\n    "what_to_pick": ["item mínimo seguro"],\n    "notes": "Última opção"\n  },\n  "avoid_list": [\n    { "title": "O que evitar", "why": "Razão específica para ESTE motorista" }\n  ]\n}`,
      profileWithData: `PERFIL DO MOTORISTA:\n- Tipo de dieta: {{DIET}}\n- Alergias (BLOQUEIO TOTAL): {{ALLERGIES}}\n- Restrições: {{RESTRICTIONS}}\n- Objetivos de saúde: {{HEALTH_GOALS}}\n- Orçamento: {{BUDGET}}`,
      noProfile: 'Sem perfil cadastrado - dê sugestões gerais saudáveis para caminhoneiros.',
      noSpecificDiet: 'Nenhuma específica',
      none: 'Nenhuma',
      mealTime: 'Horário da refeição',
      generateSpecific: `Gere sugestões ESPECÍFICAS para a conveniência DESTE posto (${station.name}).\nAs sugestões devem ser DIFERENTES e CONTEXTUAIS - não repita sempre as mesmas coisas.\nConsidere o horário, o tipo de posto, e as preferências do motorista.`,
    };
  } else if (language === 'es') {
    return {
      stationContext: `ESTACIÓN DETECTADA:\n- Nombre: ${station.name}\n- Marca/Red: ${station.brand || 'Estación independiente'}\n- Dirección: ${station.address || 'No disponible'}\n- Coordenadas: ${station.lat}, ${station.lng}`,
      systemPrompt: `Eres un nutricionista especializado en alimentación para camioneros.\nEl conductor está EN ESTA ESTACIÓN: ${station.name} (${station.brand || 'independiente'}).\n\nNO hay restaurante identificado en esta estación. DEBES sugerir SOLO artículos de la TIENDA DE CONVENIENCIA.\n\nREGLAS CRÍTICAS:\n1. Sugiere SOLO artículos realistas de conveniencia: {{BRAND_ITEMS}}\n2. NO inventes restaurantes o comidas que no existen en conveniencias\n3. Considera la hora actual (${mealType})\n4. Respeta ESTRICTAMENTE alergias y condiciones de salud\n5. Sé ESPECÍFICO - nombres de productos reales cuando sea posible\n\n${hasSugarRestriction ? 'ATENCIÓN: Este conductor tiene RESTRICCIÓN DE AZÚCAR. EVITA todos los productos con azúcar.' : ''}\n\nFORMATO DE RESPUESTA (JSON puro):\n{\n  "source": "CONVENIENCE_FALLBACK_GPT5",\n  "station": { "name": "${station.name}", "brand": "${station.brand || 'independiente'}" },\n  "best_option": {\n    "title": "Nombre de la sugerencia",\n    "why": "Por qué es la mejor opción para este conductor",\n    "what_to_pick": ["item1", "item2", "item3"],\n    "notes": "Consejo adicional"\n  },\n  "alternatives": [{\n    "title": "Alternativa",\n    "why": "Razón",\n    "what_to_pick": ["item1"],\n    "notes": "Consejo"\n  }],\n  "if_nothing_available": {\n    "title": "Emergencia",\n    "what_to_pick": ["item mínimo seguro"],\n    "notes": "Última opción"\n  },\n  "avoid_list": [\n    { "title": "Qué evitar", "why": "Razón específica para ESTE conductor" }\n  ]\n}`,
      profileWithData: `PERFIL DEL CONDUCTOR:\n- Tipo de dieta: {{DIET}}\n- Alergias (BLOQUEO TOTAL): {{ALLERGIES}}\n- Restricciones: {{RESTRICTIONS}}\n- Objetivos de salud: {{HEALTH_GOALS}}\n- Presupuesto: {{BUDGET}}`,
      noProfile: 'Sin perfil registrado - da sugerencias generales saludables para camioneros.',
      noSpecificDiet: 'Ninguna específica',
      none: 'Ninguna',
      mealTime: 'Hora de la comida',
      generateSpecific: `Genera sugerencias ESPECÍFICAS para la conveniencia de ESTA estación (${station.name}).\nLas sugerencias deben ser DIFERENTES y CONTEXTUALES - no repitas siempre lo mismo.\nConsidera la hora, el tipo de estación, y las preferencias del conductor.`,
    };
  }
  // English (default)
  return {
    stationContext: `STATION DETECTED:\n- Name: ${station.name}\n- Brand/Chain: ${station.brand || 'Independent station'}\n- Address: ${station.address || 'Not available'}\n- Coordinates: ${station.lat}, ${station.lng}`,
    systemPrompt: `You are a nutritionist specialized in truck driver nutrition.\nThe driver is at THIS EXACT STATION: ${station.name} (${station.brand || 'independent'}).\n\nNO restaurant was identified at this station. You MUST suggest ONLY items from the CONVENIENCE STORE.\n\nCRITICAL RULES:\n1. Suggest ONLY realistic convenience store items: {{BRAND_ITEMS}}\n2. DO NOT invent restaurants or foods that don't exist in convenience stores\n3. Consider the current time (${mealType})\n4. STRICTLY respect allergies and health conditions\n5. Be SPECIFIC - real product names when possible\n\n${hasSugarRestriction ? 'ATTENTION: This driver has SUGAR RESTRICTION. AVOID all products with sugar.' : ''}\n\nRESPONSE FORMAT (pure JSON):\n{\n  "source": "CONVENIENCE_FALLBACK_GPT5",\n  "station": { "name": "${station.name}", "brand": "${station.brand || 'independent'}" },\n  "best_option": {\n    "title": "Suggestion name",\n    "why": "Why this is the best option for this driver",\n    "what_to_pick": ["item1", "item2", "item3"],\n    "notes": "Additional tip"\n  },\n  "alternatives": [{\n    "title": "Alternative",\n    "why": "Reason",\n    "what_to_pick": ["item1"],\n    "notes": "Tip"\n  }],\n  "if_nothing_available": {\n    "title": "Emergency",\n    "what_to_pick": ["minimum safe item"],\n    "notes": "Last resort"\n  },\n  "avoid_list": [\n    { "title": "What to avoid", "why": "Specific reason for THIS driver" }\n  ]\n}`,
    profileWithData: `DRIVER PROFILE:\n- Diet type: {{DIET}}\n- Allergies (TOTAL BLOCK): {{ALLERGIES}}\n- Restrictions: {{RESTRICTIONS}}\n- Health goals: {{HEALTH_GOALS}}\n- Budget: {{BUDGET}}`,
    noProfile: 'No profile registered - give general healthy suggestions for truck drivers.',
    noSpecificDiet: 'None specific',
    none: 'None',
    mealTime: 'Meal time',
    generateSpecific: `Generate SPECIFIC suggestions for THIS station's convenience store (${station.name}).\nSuggestions should be DIFFERENT and CONTEXTUAL - don't always repeat the same things.\nConsider the time, station type, and driver preferences.`,
  };
}

// Get static fallback texts by language
function getStaticFallbackTexts(language: string) {
  if (language === 'pt') {
    return {
      healthyOption: 'Opção saudável da conveniência',
      bestAvailable: 'Melhor opção disponível',
      alternativeOption: 'Alternativa da conveniência',
      secondBest: 'Segunda melhor opção',
      waterNuts: 'Água + nuts',
      minSafe: 'Opção mínima segura',
    };
  } else if (language === 'es') {
    return {
      healthyOption: 'Opción saludable de la conveniencia',
      bestAvailable: 'Mejor opción disponible',
      alternativeOption: 'Alternativa de la conveniencia',
      secondBest: 'Segunda mejor opción',
      waterNuts: 'Agua + nueces',
      minSafe: 'Opción mínima segura',
    };
  }
  return {
    healthyOption: 'Healthy convenience store option',
    bestAvailable: 'Best available option',
    alternativeOption: 'Convenience store alternative',
    secondBest: 'Second best option',
    waterNuts: 'Water + nuts',
    minSafe: 'Minimum safe option',
  };
}

  console.log(`[FOOD_REC:${requestId}] Calling GPT-5 for convenience fallback...`);
  console.log(`[FOOD_REC:${requestId}] Station: ${station.name}, Brand: ${station.brand}, Meal: ${mealType}`);

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
      temperature: 0.9, // Higher temperature for more variety
      max_tokens: 1500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[FOOD_REC:${requestId}] GPT-5 error:`, response.status, errorText);
    
    // Return contextual static fallback if GPT-5 fails
    return getStaticConvenienceFallback(station, profile, mealType, language);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    console.error(`[FOOD_REC:${requestId}] No content in GPT-5 response`);
    return getStaticConvenienceFallback(station, profile, mealType, language);
  }

  try {
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent);
    
    console.log(`[FOOD_REC:${requestId}] GPT-5 response parsed successfully`);
    
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
    console.error(`[FOOD_REC:${requestId}] Failed to parse GPT-5 response:`, content);
    return getStaticConvenienceFallback(station, profile, mealType, language);
  }
}

// Get brand-specific convenience items
function getBrandSpecificItems(brand?: string, language: string = 'en'): string {
  const normalizedBrand = brand?.toLowerCase() || '';
  
  if (normalizedBrand.includes('love')) {
    return "Fresh-to-Go sandwiches, Chester's chicken, Godfather's pizza, boiled eggs, yogurt, nuts, jerky, fresh fruit cups, coffee, energy drinks";
  }
  if (normalizedBrand.includes('pilot') || normalizedBrand.includes('flying j')) {
    return "PJ Fresh food, Cinnabon, Subway, pizza, boiled eggs, yogurt cups, protein bars, nuts, fruit, coffee, energy drinks";
  }
  if (normalizedBrand.includes('ta') || normalizedBrand.includes('petro')) {
    return "Iron Skillet items, Country Pride food, boiled eggs, salads, sandwiches, yogurt, nuts, fruit, coffee, protein bars";
  }
  if (normalizedBrand.includes('buc-ee')) {
    return "Buc-ee's BBQ, beaver nuggets (avoid if low sugar), kolaches, jerky, fresh sandwiches, nuts, fruit, coffee";
  }
  
  // Generic convenience store items
  return "ovos cozidos, iogurte natural/grego, queijo, nuts (amêndoas, castanhas), frutas frescas, saladas prontas, wraps, sanduíches naturais, água, café, chá sem açúcar, jerky (atenção ao sódio)";
}

// Static fallback with contextual variation - NO CACHE
function getStaticConvenienceFallback(station: StationInfo, profile: FoodProfile | null, mealType: string, language: string = 'en'): any {
  const isLowSugar = profile?.health_goals?.some(g => 
    g.toLowerCase().includes('diabetes') || 
    g.toLowerCase().includes('sugar') ||
    g.toLowerCase().includes('açúcar')
  );
  
  const isLowSodium = profile?.health_goals?.some(g => 
    g.toLowerCase().includes('sodium') || 
    g.toLowerCase().includes('sódio') ||
    g.toLowerCase().includes('pressão')
  );

  // Vary recommendations based on meal type - check all language variants
  const isMorning = mealType.includes('café') || mealType.includes('manhã') || mealType.includes('breakfast') || mealType.includes('desayuno');
  const isAfternoon = mealType.includes('tarde') || mealType.includes('lanche') || mealType.includes('afternoon') || mealType.includes('merienda');
  
  let bestChoice, alternative, emergency;
  
  if (isMorning) {
    bestChoice = isLowSugar
      ? { item: "Ovos cozidos + café sem açúcar", reason: "Proteína pura para começar o dia, zero carboidrato", what_to_pick: ["2 ovos cozidos", "Café preto sem açúcar", "Água mineral"] }
      : { item: "Iogurte com granola + banana", reason: "Energia sustentada para a manhã", what_to_pick: ["Iogurte natural", "Granola sem açúcar", "Banana"] };
    alternative = { item: "Sanduíche natural de frango", reason: "Proteína magra e praticidade", what_to_pick: ["Sanduíche integral", "Água"] };
    emergency = { item: "Nuts + água", reason: "Energia rápida sem açúcar", what_to_pick: ["Amêndoas ou castanhas", "Água grande"] };
  } else if (isAfternoon) {
    bestChoice = isLowSugar
      ? { item: "Queijo + nuts", reason: "Snack proteico sem carboidratos", what_to_pick: ["Queijo em cubos", "Mix de nuts", "Água com gás"] }
      : { item: "Wrap de frango + suco", reason: "Refeição leve e energética", what_to_pick: ["Wrap integral", "Suco natural"] };
    alternative = { item: "Salada de frutas + iogurte", reason: "Vitaminas e probióticos", what_to_pick: ["Salada de frutas", "Iogurte grego"] };
    emergency = { item: "Barrinha de proteína + água", reason: "Energia controlada", what_to_pick: ["Barra de proteína", "Água"] };
  } else {
    // Evening/night
    bestChoice = isLowSugar
      ? { item: "Ovos + queijo + vegetais", reason: "Jantar leve sem carboidratos", what_to_pick: ["Ovos cozidos", "Queijo", "Palitos de cenoura se tiver"] }
      : { item: "Sanduíche de peru + salada", reason: "Jantar balanceado", what_to_pick: ["Sanduíche de peru", "Salada verde"] };
    alternative = { item: "Sopa instantânea + crackers", reason: "Reconfortante e prático", what_to_pick: isLowSodium ? ["Sopa baixo sódio", "Crackers integrais"] : ["Sopa de legumes", "Crackers"] };
    emergency = { item: "Jerky + água (porção pequena)", reason: "Proteína de emergência", what_to_pick: ["Jerky porção pequena", "Muita água"] };
  }

  const avoidList = [];
  
  if (isLowSugar) {
    avoidList.push({ item: "Refrigerantes e sucos de caixa", reason: "PERIGOSO - alto índice glicêmico" });
    avoidList.push({ item: "Doces, chocolates, bolachas", reason: "Açúcar alto - evitar completamente" });
  } else {
    avoidList.push({ item: "Refrigerantes grandes", reason: "Calorias vazias, desidratação" });
  }
  
  if (isLowSodium) {
    avoidList.push({ item: "Salgadinhos e snacks industrializados", reason: "Sódio excessivo" });
    avoidList.push({ item: "Embutidos (presunto, salame)", reason: "Alto teor de sódio" });
  } else {
    avoidList.push({ item: "Frituras e salgadinhos", reason: "Gordura trans e sódio alto" });
  }

  return {
    source: "CONVENIENCE_FALLBACK_STATIC",
    station: { name: station.name, brand: station.brand },
    best_choice: bestChoice,
    alternative,
    emergency_option: emergency,
    avoid: avoidList,
    is_convenience_fallback: true,
  };
}
