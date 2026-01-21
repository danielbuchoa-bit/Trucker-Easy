import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user is admin using their token
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is admin using service role
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden - Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "summary";
    const userId = url.searchParams.get("userId");

    // Get admin data based on action
    if (action === "summary") {
      // Get all users with activity counts
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name, created_at")
        .order("created_at", { ascending: false });

      if (!profiles) {
        return new Response(JSON.stringify({ users: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get activity counts for each user
      const usersWithActivity = await Promise.all(
        profiles.map(async (profile) => {
          const [reports, facilityRatings, stopRatings, poiFeedback, checkins, messages] = await Promise.all([
            adminClient.from("road_reports").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            adminClient.from("facility_ratings").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            adminClient.from("stop_ratings").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            adminClient.from("poi_feedback").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            adminClient.from("emotional_checkins").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
            adminClient.from("chat_messages").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
          ]);

          return {
            ...profile,
            total_reports: reports.count || 0,
            total_facility_ratings: facilityRatings.count || 0,
            total_stop_ratings: stopRatings.count || 0,
            total_poi_feedback: poiFeedback.count || 0,
            total_checkins: checkins.count || 0,
            total_messages: messages.count || 0,
            total_activity: (reports.count || 0) + (facilityRatings.count || 0) + (stopRatings.count || 0) + (poiFeedback.count || 0),
          };
        })
      );

      return new Response(JSON.stringify({ users: usersWithActivity }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "user_details" && userId) {
      // Get detailed activity for specific user
      const [profile, reports, facilityRatings, stopRatings, poiFeedback, checkins] = await Promise.all([
        adminClient.from("profiles").select("*").eq("id", userId).single(),
        adminClient.from("road_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("facility_ratings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("stop_ratings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("poi_feedback").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("emotional_checkins").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      ]);

      return new Response(JSON.stringify({
        profile: profile.data,
        reports: reports.data || [],
        facility_ratings: facilityRatings.data || [],
        stop_ratings: stopRatings.data || [],
        poi_feedback: poiFeedback.data || [],
        checkins: checkins.data || [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stats") {
      // Get overall platform stats
      const [totalUsers, totalReports, totalRatings, totalCheckins] = await Promise.all([
        adminClient.from("profiles").select("id", { count: "exact", head: true }),
        adminClient.from("road_reports").select("id", { count: "exact", head: true }),
        adminClient.from("facility_ratings").select("id", { count: "exact", head: true }),
        adminClient.from("emotional_checkins").select("id", { count: "exact", head: true }),
      ]);

      return new Response(JSON.stringify({
        total_users: totalUsers.count || 0,
        total_reports: totalReports.count || 0,
        total_ratings: totalRatings.count || 0,
        total_checkins: totalCheckins.count || 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Admin data error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
