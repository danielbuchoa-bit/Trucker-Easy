import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Urgency = "normal" | "today" | "alert" | "urgent";

type NewsRowInsert = {
  title: string;
  summary: string;
  image_url: string | null;
  source_url: string;
  source: string;
  category: string;
  urgency: Urgency;
  published_at: string;
};

type NewsItemResponse = NewsRowInsert & {
  // usado só no frontend para key do React; no banco o id é uuid e é gerado automaticamente
  id: string;
};

interface NewsAPIArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string | null;
  source: { name: string };
  publishedAt: string;
}

// Categorize article based on title/description keywords
function categorizeArticle(title: string, description: string): { category: string; urgency: Urgency } {
  const text = `${title} ${description}`.toLowerCase();
  
  if (text.includes("diesel") || text.includes("fuel price") || text.includes("gas price")) {
    return { category: "Diesel Prices", urgency: "today" };
  }
  if (
    text.includes("dot") ||
    text.includes("fmcsa") ||
    text.includes("regulation") ||
    text.includes("compliance") ||
    text.includes("eld")
  ) {
    return { category: "Regulations", urgency: "alert" };
  }
  if (
    text.includes("weather") ||
    text.includes("storm") ||
    text.includes("snow") ||
    text.includes("flood") ||
    text.includes("hurricane") ||
    text.includes("tornado")
  ) {
    return { category: "Weather", urgency: "urgent" };
  }
  if (text.includes("recall") || text.includes("defect") || text.includes("safety alert")) {
    return { category: "Recall", urgency: "urgent" };
  }
  if (
    text.includes("accident") ||
    text.includes("crash") ||
    text.includes("fatality") ||
    text.includes("safety")
  ) {
    return { category: "Safety", urgency: "alert" };
  }
  if (text.includes("weigh station") || text.includes("inspection") || text.includes("scale")) {
    return { category: "Weigh Station", urgency: "today" };
  }
  if (
    text.includes("freight") ||
    text.includes("logistics") ||
    text.includes("shipping") ||
    text.includes("supply chain") ||
    text.includes("trucking")
  ) {
    return { category: "Industry", urgency: "normal" };
  }
  
  return { category: "Industry", urgency: "normal" };
}

// Fetch news from NewsAPI.org
const FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=400&h=200&fit=crop";

async function fetchFromNewsAPI(apiKey: string): Promise<NewsItemResponse[]> {
  const searchQueries = [
    'trucking industry USA',
    'freight logistics',
    'diesel fuel prices',
    'FMCSA regulations',
    'truck driver',
    'commercial trucking'
  ];
  
  const allArticles: NewsAPIArticle[] = [];
  const seenUrls = new Set<string>();
  
  for (const query of searchQueries) {
    try {
      const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10`;
      
      console.log(`[NEWSAPI] Fetching: ${query}`);
      
      const response = await fetch(url, {
        headers: {
          'X-Api-Key': apiKey,
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[NEWSAPI] Error fetching ${query}: ${response.status} - ${errorText}`);
        continue;
      }
      
      const data = await response.json();
      
      if (data.articles && Array.isArray(data.articles)) {
        for (const article of data.articles) {
          // Filter out articles without proper content
          if (!seenUrls.has(article.url) && article.title && article.description && 
              article.title !== '[Removed]' && article.description !== '[Removed]') {
            seenUrls.add(article.url);
            allArticles.push(article);
          }
        }
      }
    } catch (error) {
      console.error(`[NEWSAPI] Error with query ${query}:`, error);
    }
  }
  
  console.log(`[NEWSAPI] Total unique articles fetched: ${allArticles.length}`);
  
  // Convert to our format and limit to 20 articles
  const newsItems: NewsItemResponse[] = allArticles.slice(0, 20).map((article, index) => {
    const { category, urgency } = categorizeArticle(article.title, article.description || "");

    return {
      id: crypto.randomUUID(),
      title: article.title,
      summary: (article.description || "").slice(0, 300),
      image_url: article.urlToImage || FALLBACK_IMAGE,
      source_url: article.url,
      source: article.source.name,
      category,
      urgency,
      published_at: article.publishedAt || new Date().toISOString(),
    };
  });
  
  return newsItems;
}

// Fallback: Generate local news if API fails
function generateFallbackNews(): NewsItemResponse[] {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  
  const templates = [
    {
      title: "National Diesel Prices Update",
      summary: "The latest diesel fuel prices across the nation show varying trends. West Coast prices remain highest while Midwest offers better rates. Check local prices before fueling up.",
      category: "Diesel",
      urgency: "high",
      source: "EIA Report"
    },
    {
      title: "FMCSA Announces Updated Hours of Service Guidelines",
      summary: "Federal Motor Carrier Safety Administration releases updated guidelines for commercial drivers. New flexibility provisions may affect your daily planning.",
      category: "Regulation",
      urgency: "high",
      source: "FMCSA"
    },
    {
      title: "Weather Advisory for Major Freight Corridors",
      summary: "Multiple weather systems affecting Interstate highways across the Northern Plains and Rocky Mountains. Plan routes accordingly and check conditions before departure.",
      category: "Weather",
      urgency: "urgent",
      source: "NWS"
    },
    {
      title: "Freight Market Analysis: Weekly Trends",
      summary: "Latest freight rates and market conditions show stabilization. Spot rates holding steady while contract negotiations continue for Q2.",
      category: "Industry",
      urgency: "low",
      source: "Freight Analysis"
    },
    {
      title: "Safety Reminder: Pre-Trip Inspection Best Practices",
      summary: "FMCSA emphasizes the importance of thorough pre-trip inspections. Focus areas include brake systems, lights, and cargo securement.",
      category: "Safety",
      urgency: "medium",
      source: "Safety Council"
    },
    {
      title: "Weigh Station Updates: New Bypass Technology",
      summary: "Several states implementing new PrePass and Drivewyze bypass systems. Check your subscription status for available bypasses on your routes.",
      category: "Weigh Station",
      urgency: "low",
      source: "DOT"
    },
    {
      title: "Truck Parking Shortage Solutions Being Explored",
      summary: "DOT and state agencies working on expanding truck parking capacity. New rest areas planned along major corridors to address critical shortage.",
      category: "Industry",
      urgency: "low",
      source: "FHWA"
    },
    {
      title: "ELD Compliance Enforcement Intensifies",
      summary: "FMCSA reports increased out-of-service orders for ELD violations. Ensure your device is properly registered and functioning correctly.",
      category: "Regulation",
      urgency: "high",
      source: "FMCSA"
    }
  ];
  
  return templates.map((t, i) => ({
    id: crypto.randomUUID(),
    title: t.title,
    summary: t.summary,
    image_url: FALLBACK_IMAGE,
    source_url: "#",
    source: t.source,
    category: t.category,
    urgency: (t.urgency as Urgency) || "normal",
    published_at: now.toISOString()
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const newsApiKey = Deno.env.get("NEWSAPI_KEY");
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    let forceRefresh = false;
    try {
      const body = await req.json();
      forceRefresh = body?.forceRefresh === true;
    } catch {
      // No body or invalid JSON, use defaults
    }

    const nowIso = new Date().toISOString();
    const today = nowIso.split("T")[0];

    // Check if we have fresh news fetched today (unless force refresh)
    if (!forceRefresh) {
      const { data: existingNews, error: fetchError } = await supabase
        .from("trucking_news")
        .select("*")
        .gte("fetched_at", `${today}T00:00:00Z`)
        .order("fetched_at", { ascending: false })
        .limit(20);

      if (!fetchError && existingNews && existingNews.length >= 5) {
        console.log(`[NEWS] Returning ${existingNews.length} cached news items from today`);
        return new Response(
          JSON.stringify({
            ok: true,
            cached: true,
            news: existingNews,
            itemCount: existingNews.length,
            generatedAt: existingNews[0]?.fetched_at || nowIso,
          }),
          {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    console.log("[NEWS] Fetching fresh news...");

    // Fetch from NewsAPI if key is available
    let newsItems: NewsItemResponse[];
    let source = "generated";
    
    if (newsApiKey) {
      console.log("[NEWS] Using NewsAPI.org with API key");
      try {
        newsItems = await fetchFromNewsAPI(newsApiKey);
        source = "newsapi";
        
        if (newsItems.length === 0) {
          console.log("[NEWS] NewsAPI returned no results, using fallback");
          newsItems = generateFallbackNews();
          source = "fallback";
        }
      } catch (error) {
        console.error("[NEWS] NewsAPI error, using fallback:", error);
        newsItems = generateFallbackNews();
        source = "fallback";
      }
    } else {
      console.log("[NEWS] No NEWSAPI_KEY configured, using fallback");
      newsItems = generateFallbackNews();
      source = "fallback";
    }

    // Clean up old news (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { error: deleteOldError } = await supabase
      .from("trucking_news")
      .delete()
      .lt("fetched_at", sevenDaysAgo.toISOString());
    
    if (deleteOldError) {
      console.log("[NEWS] Error deleting old news:", deleteOldError.message);
    }

    // Delete today's old fetches before inserting new (to avoid duplicates)
    const { error: deleteTodayError } = await supabase
      .from("trucking_news")
      .delete()
      .gte("fetched_at", `${today}T00:00:00Z`);
    
    if (deleteTodayError) {
      console.log("[NEWS] Error deleting today's news:", deleteTodayError.message);
    }

    // Insert new news (sem enviar `id` — o banco gera uuid automaticamente)
    const rowsToInsert: NewsRowInsert[] = newsItems.map((n) => ({
      title: n.title,
      summary: n.summary,
      image_url: n.image_url,
      source_url: n.source_url,
      source: n.source,
      category: n.category,
      urgency: n.urgency,
      published_at: n.published_at,
    }));

    const { error: insertError } = await supabase
      .from("trucking_news")
      .insert(rowsToInsert);

    if (insertError) {
      console.error("[NEWS] Insert error:", insertError);
      // Return the news anyway even if insert fails
      return new Response(
        JSON.stringify({
          // Mantém o app funcionando mesmo se o insert falhar
          ok: true,
          cached: false,
          news: newsItems,
          itemCount: newsItems.length,
          generatedAt: nowIso,
          warning: `Insert failed: ${insertError.message}`,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[NEWS] Successfully fetched and stored ${newsItems.length} news items from ${source}`);

    return new Response(
      JSON.stringify({
        ok: true,
        cached: false,
        news: newsItems,
        itemCount: newsItems.length,
        generatedAt: nowIso,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("[NEWS] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to fetch news";
    return new Response(
      JSON.stringify({
        ok: false,
        error: errorMessage,
        news: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
