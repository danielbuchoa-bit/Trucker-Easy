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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile, menuItems, placeType, stopName, restaurantNames } = await req.json() as {
      profile: FoodProfile | null;
      menuItems: MenuItem[];
      placeType: string;
      stopName?: string;
      restaurantNames?: string[];
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    console.log("Request received:", { stopName, restaurantNames, menuItemsCount: menuItems.length, hasProfile: !!profile });

    // Build the prompt based on driver profile
    const profileDescription = profile ? `
Driver Profile:
- Diet: ${profile.diet_type || 'No specific diet'}
- Allergies (HARD BLOCK - never recommend): ${profile.allergies?.length ? profile.allergies.join(', ') : 'None'}
- Restrictions: ${profile.restrictions?.length ? profile.restrictions.join(', ') : 'None'}
- Health Goals: ${profile.health_goals?.length ? profile.health_goals.join(', ') : 'None'}
- Budget: ${profile.budget_preference || 'moderate'}
` : 'No profile available - give general healthy recommendations for truck drivers.';

    // Build context about the location and available restaurants
    let locationContext = `Stop: ${stopName || placeType}`;
    
    if (restaurantNames && restaurantNames.length > 0) {
      locationContext += `\n\nRestaurants/Food Options at this location:\n${restaurantNames.map(r => `- ${r}`).join('\n')}`;
      locationContext += `\n\nBased on these SPECIFIC restaurants available, recommend items that would typically be on their menus.`;
    } else if (menuItems.length > 0) {
      locationContext += `\n\nAvailable menu items:\n${menuItems.map(m => `- ${m.item_name} (${m.category})${m.price ? ` $${m.price}` : ''}`).join('\n')}`;
    } else {
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
        model: "google/gemini-2.5-flash",
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

    // Parse the JSON response
    let recommendation;
    try {
      // Remove markdown code blocks if present
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      recommendation = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", content);
      // Return a fallback response
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
