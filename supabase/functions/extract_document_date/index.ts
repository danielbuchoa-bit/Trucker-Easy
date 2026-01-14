import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, documentType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    if (!imageUrl) {
      throw new Error("Image URL is required");
    }

    const documentTypeLabels: Record<string, string> = {
      'cdl': 'CDL (Commercial Driver License)',
      'medical_card': 'DOT Medical Card',
      'truck_registration': 'Truck Registration',
      'trailer_registration': 'Trailer Registration',
      'ifta': 'IFTA (International Fuel Tax Agreement)',
      'irp': 'IRP (International Registration Plan)',
      'insurance': 'Commercial Insurance Certificate',
      'dot_inspection': 'DOT Annual Inspection',
      'hazmat': 'Hazmat Endorsement',
      'twic': 'TWIC Card',
    };

    const docLabel = documentTypeLabels[documentType] || documentType;

    const systemPrompt = `You are an expert document reader specialized in US commercial trucking documents.
Your task is to extract the EXPIRATION DATE from the provided document image.

Document type: ${docLabel}

IMPORTANT INSTRUCTIONS:
1. Look carefully for expiration date, valid until, expires, exp date, or similar fields
2. Return ONLY the date in ISO format: YYYY-MM-DD
3. If you cannot find an expiration date, return: NOT_FOUND
4. If the image is unclear or not a valid document, return: INVALID_DOCUMENT
5. Do not include any other text, just the date or status code

Common locations for expiration dates:
- CDL: Usually on the front, near the driver's photo
- Medical Card: Usually at the bottom, "Expires" field
- Registration: Usually labeled "Expires" or "Valid Until"
- IFTA: Quarter/Year format, convert to end of quarter
- Insurance: Policy expiration date

Return ONLY the date in YYYY-MM-DD format or the status code.`;

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
          { 
            role: "user", 
            content: [
              {
                type: "text",
                text: "Please extract the expiration date from this document image."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          },
        ],
        max_tokens: 100,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Rate limit exceeded. Please try again later." 
        }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error("Failed to analyze document");
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content?.trim() || "";
    
    console.log("Extracted text:", extractedText);

    // Parse the response
    if (extractedText === "NOT_FOUND") {
      return new Response(JSON.stringify({ 
        success: true, 
        found: false,
        message: "Could not find expiration date in document" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (extractedText === "INVALID_DOCUMENT") {
      return new Response(JSON.stringify({ 
        success: true, 
        found: false,
        message: "Image does not appear to be a valid document" 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (dateRegex.test(extractedText)) {
      // Validate it's a real date
      const parsedDate = new Date(extractedText);
      if (!isNaN(parsedDate.getTime())) {
        return new Response(JSON.stringify({ 
          success: true, 
          found: true,
          expirationDate: extractedText 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Try to extract date from response if it contains extra text
    const dateMatch = extractedText.match(/(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      return new Response(JSON.stringify({ 
        success: true, 
        found: true,
        expirationDate: dateMatch[1] 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      found: false,
      message: "Could not parse expiration date from document" 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Extract document date error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
