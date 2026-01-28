import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Extract expiration date from a driver document image (CDL or Medical Card)
 * using Lovable AI with vision capabilities
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("[extract_document_date] LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageUrl, documentType } = await req.json();

    if (!imageUrl) {
      return new Response(
        JSON.stringify({ error: "imageUrl is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[extract_document_date] Processing ${documentType || 'document'} image`);

    // Fetch the image and convert to base64
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      console.error("[extract_document_date] Failed to fetch image:", imageResponse.status);
      return new Response(
        JSON.stringify({ error: "Failed to fetch document image" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const base64Image = btoa(
      new Uint8Array(imageArrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Determine the image MIME type
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    // Create the prompt for extracting the expiration date
    const systemPrompt = `You are an expert at reading and extracting information from driver documents.
Your task is to find the EXPIRATION DATE from the document image.

For CDL (Commercial Driver License):
- Look for fields like "EXP", "EXPIRES", "EXPIRATION DATE", or similar
- The date is usually on the front of the license

For DOT Medical Card (Medical Examiner's Certificate):
- Look for "Expiration date of this certificate" or similar
- Usually at the bottom of the certificate
- Format is often MM/DD/YYYY or written out as "Month Day, Year"

IMPORTANT: 
- Return ONLY the date in ISO format (YYYY-MM-DD)
- If you cannot find a clear expiration date, return null
- Do not guess or make up dates`;

    const userPrompt = `Extract the expiration date from this ${documentType === 'cdl' ? 'Commercial Driver License (CDL)' : 'DOT Medical Card'} image. 
Return ONLY the expiration date in YYYY-MM-DD format, or null if not found.`;

    // Call Lovable AI with vision
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_expiration_date",
              description: "Extract the expiration date from a driver document",
              parameters: {
                type: "object",
                properties: {
                  expiration_date: {
                    type: "string",
                    description: "The expiration date in YYYY-MM-DD format, or null if not found",
                    nullable: true,
                  },
                  confidence: {
                    type: "string",
                    enum: ["high", "medium", "low"],
                    description: "Confidence level of the extraction",
                  },
                  raw_text: {
                    type: "string",
                    description: "The raw text found for the expiration date field",
                  },
                },
                required: ["expiration_date", "confidence"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_expiration_date" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI service payment required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await aiResponse.text();
      console.error("[extract_document_date] AI error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI processing failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("[extract_document_date] AI response:", JSON.stringify(aiData, null, 2));

    // Extract the tool call result
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      // Fallback: try to parse from content
      const content = aiData.choices?.[0]?.message?.content || "";
      const dateMatch = content.match(/\d{4}-\d{2}-\d{2}/);
      
      if (dateMatch) {
        console.log(`[extract_document_date] Extracted date from content: ${dateMatch[0]}`);
        return new Response(
          JSON.stringify({
            expiration_date: dateMatch[0],
            confidence: "medium",
            source: "content_parse",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          expiration_date: null,
          confidence: "low",
          error: "Could not extract date from document",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = JSON.parse(toolCall.function.arguments);
    console.log(`[extract_document_date] Extracted: ${result.expiration_date} (${result.confidence})`);

    return new Response(
      JSON.stringify({
        expiration_date: result.expiration_date,
        confidence: result.confidence,
        raw_text: result.raw_text,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[extract_document_date] Error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
