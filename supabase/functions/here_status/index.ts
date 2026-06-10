import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * HERE Status: checks which HERE services the configured API key can access.
 * Returns { geocoding: {ok, status, cause}, routing: {ok, status, cause}, allOk, message }
 */
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const apiKey = Deno.env.get("HERE_API_KEY");
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        allOk: false,
        message: "HERE_API_KEY não configurada no backend.",
        geocoding: { ok: false, status: 0, cause: "missing key" },
        routing: { ok: false, status: 0, cause: "missing key" },
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  async function probe(url: string) {
    try {
      const res = await fetch(url);
      const txt = await res.text();
      let body: any = {};
      try { body = JSON.parse(txt); } catch { /* ignore */ }
      return {
        ok: res.ok,
        status: res.status,
        cause: body?.cause || body?.title || body?.error_description || (res.ok ? "ok" : "denied"),
      };
    } catch (e) {
      return { ok: false, status: 0, cause: e instanceof Error ? e.message : "network error" };
    }
  }

  // Minimal probes (use tiny payloads to avoid charges)
  const geocoding = await probe(
    `https://geocode.search.hereapi.com/v1/geocode?q=Paris&limit=1&apiKey=${apiKey}`
  );
  const routing = await probe(
    `https://router.hereapi.com/v8/routes?transportMode=truck&origin=48.8566,2.3522&destination=48.8606,2.3376&return=summary&apikey=${apiKey}`
  );

  const missing: string[] = [];
  if (!geocoding.ok) missing.push("Geocoding & Search v7");
  if (!routing.ok) missing.push("Routing v8");

  const allOk = missing.length === 0;
  const message = allOk
    ? "Todos os serviços HERE habilitados."
    : `Serviços HERE faltando permissão: ${missing.join(", ")}. Em platform.here.com → Access Manager → Apps → seu App → Service Subscriptions, ative esses serviços.`;

  console.log("[here_status]", { allOk, geocoding, routing });

  return new Response(
    JSON.stringify({ allOk, message, geocoding, routing }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});