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

    // Log admin action for audit trail
    const adminUserId = user.id;
    async function logAdminAction(action: string, targetType: string, targetId?: string, details?: Record<string, unknown>) {
      try {
        await adminClient.from("admin_audit_log").insert({
          admin_user_id: adminUserId,
          action,
          target_type: targetType,
          target_id: targetId,
          details,
          ip_address: req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip"),
        });
      } catch (e) {
        console.error("Failed to log admin action:", e);
      }
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "summary";
    const userId = url.searchParams.get("userId");

    // Get admin data based on action
    if (action === "summary") {
      await logAdminAction("view_users", "users");
      
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

      // Get subscriptions for all users
      const { data: subscriptions } = await adminClient
        .from("subscriptions")
        .select("user_id, provider, status, plan_tier, current_period_end");

      const subscriptionMap = new Map(
        subscriptions?.map(s => [s.user_id, s]) || []
      );

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

          const sub = subscriptionMap.get(profile.id);

          return {
            ...profile,
            subscription: sub || null,
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
      await logAdminAction("view_user_details", "user", userId);
      
      // Get detailed activity for specific user
      const [profile, subscription, reports, facilityRatings, stopRatings, poiFeedback, checkins] = await Promise.all([
        adminClient.from("profiles").select("*").eq("id", userId).single(),
        adminClient.from("subscriptions").select("*").eq("user_id", userId).maybeSingle(),
        adminClient.from("road_reports").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("facility_ratings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("stop_ratings").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("poi_feedback").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
        adminClient.from("emotional_checkins").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      ]);

      return new Response(JSON.stringify({
        profile: profile.data,
        subscription: subscription.data,
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
      const [totalUsers, totalReports, totalRatings, totalCheckins, subscriptionStats] = await Promise.all([
        adminClient.from("profiles").select("id", { count: "exact", head: true }),
        adminClient.from("road_reports").select("id", { count: "exact", head: true }),
        adminClient.from("facility_ratings").select("id", { count: "exact", head: true }),
        adminClient.from("emotional_checkins").select("id", { count: "exact", head: true }),
        adminClient.from("subscriptions").select("status, plan_tier, provider"),
      ]);

      // Calculate subscription metrics
      const subs = subscriptionStats.data || [];
      const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'trialing');
      
      const byTier = {
        silver: activeSubs.filter(s => s.plan_tier === 'silver').length,
        gold: activeSubs.filter(s => s.plan_tier === 'gold').length,
        diamond: activeSubs.filter(s => s.plan_tier === 'diamond').length,
      };
      
      const byProvider = {
        stripe: activeSubs.filter(s => s.provider === 'stripe').length,
        apple: activeSubs.filter(s => s.provider === 'apple').length,
        google: activeSubs.filter(s => s.provider === 'google').length,
      };

      return new Response(JSON.stringify({
        total_users: totalUsers.count || 0,
        total_reports: totalReports.count || 0,
        total_ratings: totalRatings.count || 0,
        total_checkins: totalCheckins.count || 0,
        subscriptions: {
          total_active: activeSubs.length,
          by_tier: byTier,
          by_provider: byProvider,
        },
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "subscriptions") {
      const status = url.searchParams.get("status");
      const provider = url.searchParams.get("provider");
      const tier = url.searchParams.get("tier");
      
      await logAdminAction("view_subscriptions", "subscriptions", undefined, { status, provider, tier });
      
      // First get subscriptions
      let query = adminClient.from("subscriptions").select("*");
      
      if (status) query = query.eq("status", status);
      if (provider) query = query.eq("provider", provider);
      if (tier) query = query.eq("plan_tier", tier);
      
      const { data: subs, error } = await query.order("updated_at", { ascending: false });
      
      if (error) throw error;
      
      // Then get profiles for each subscription
      const userIds = subs?.map(s => s.user_id) || [];
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name")
        .in("id", userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const data = subs?.map(s => ({
        ...s,
        profiles: profileMap.get(s.user_id) || { email: null, full_name: null }
      })) || [];
      

      return new Response(JSON.stringify({ subscriptions: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "audit_log") {
      const { data } = await adminClient
        .from("admin_audit_log")
        .select(`
          *,
          admin:profiles!admin_user_id(email, full_name)
        `)
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ logs: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "documents") {
      await logAdminAction("view_documents", "documents");
      
      const { data } = await adminClient
        .from("driver_documents")
        .select(`
          *,
          profiles!user_id(email, full_name)
        `)
        .order("created_at", { ascending: false });

      return new Response(JSON.stringify({ documents: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "ratings") {
      await logAdminAction("view_ratings", "ratings");

      // Get all poi_feedback with user info
      const { data: poiFeedback } = await adminClient
        .from("poi_feedback")
        .select("*")
        .order("created_at", { ascending: false });

      // Get all facility_reviews with user info
      const { data: facilityReviews } = await adminClient
        .from("facility_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      // Get facilities for name mapping
      const { data: facilities } = await adminClient
        .from("facilities")
        .select("id, name, facility_type, address");

      // Get profiles for driver names
      const allUserIds = new Set<string>();
      poiFeedback?.forEach(f => allUserIds.add(f.user_id));
      facilityReviews?.forEach(f => allUserIds.add(f.user_id));

      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, email, full_name")
        .in("id", Array.from(allUserIds));

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const facilityMap = new Map(facilities?.map(f => [f.id, f]) || []);

      // Gas station brand keywords for grouping
      const BRAND_PATTERNS: Record<string, RegExp> = {
        "Love's": /love'?s/i,
        "Pilot/Flying J": /pilot|flying\s*j/i,
        "TA/Petro": /\bta\b|petro|travelcenter/i,
        "Kwik Trip": /kwik\s*trip/i,
        "Town Pump": /town\s*pump/i,
        "Speedway": /speedway/i,
        "7-Eleven": /7.eleven/i,
        "Shell": /\bshell\b/i,
        "Chevron": /chevron/i,
        "BP": /\bbp\b/i,
        "Casey's": /casey/i,
        "Buc-ee's": /buc.?ee/i,
        "Sapp Bros": /sapp/i,
        "QuikTrip": /quiktrip/i,
        "Sheetz": /sheetz/i,
        "Wawa": /wawa/i,
        "Cat Scale": /cat\s*scale/i,
      };

      function detectBrand(name: string): string {
        for (const [brand, pattern] of Object.entries(BRAND_PATTERNS)) {
          if (pattern.test(name)) return brand;
        }
        return "Other";
      }

      // Process poi_feedback (gas stations / truck stops)
      const gasStationRatings = (poiFeedback || []).map(f => {
        const profile = profileMap.get(f.user_id);
        const avgRating = ((f.friendliness_rating + f.cleanliness_rating + f.recommendation_rating + (f.structure_rating || 0)) / (f.structure_rating ? 4 : 3));
        return {
          id: f.id,
          type: 'gas_station' as const,
          poi_name: f.poi_name,
          poi_type: f.poi_type,
          brand: detectBrand(f.poi_name),
          avg_rating: Math.round(avgRating * 10) / 10,
          friendliness: f.friendliness_rating,
          cleanliness: f.cleanliness_rating,
          recommendation: f.recommendation_rating,
          structure: f.structure_rating,
          would_return: f.would_return,
          driver_name: profile?.full_name || profile?.email || 'Unknown',
          driver_id: f.user_id,
          created_at: f.created_at,
        };
      });

      // Process facility_reviews
      const facilityRatings = (facilityReviews || []).map(f => {
        const profile = profileMap.get(f.user_id);
        const facility = facilityMap.get(f.facility_id);
        return {
          id: f.id,
          type: 'facility' as const,
          facility_name: facility?.name || `Facility ${f.facility_id.slice(0, 8)}`,
          facility_type: facility?.facility_type || 'unknown',
          facility_address: facility?.address,
          overall_rating: f.overall_rating,
          treatment: f.treatment_rating,
          speed: f.speed_rating,
          staff_help: f.staff_help_rating,
          parking: f.parking_rating,
          exit_ease: f.exit_ease_rating,
          visit_type: f.visit_type,
          time_spent: f.time_spent,
          tips: f.tips,
          driver_name: profile?.full_name || profile?.email || 'Unknown',
          driver_id: f.user_id,
          created_at: f.created_at,
        };
      });

      // Brand averages for gas stations
      const brandMap = new Map<string, { total: number; count: number; reviews: number }>();
      gasStationRatings.forEach(r => {
        const existing = brandMap.get(r.brand) || { total: 0, count: 0, reviews: 0 };
        existing.total += r.avg_rating;
        existing.count += 1;
        existing.reviews = existing.count;
        brandMap.set(r.brand, existing);
      });

      const brandAverages = Array.from(brandMap.entries())
        .map(([brand, data]) => ({
          brand,
          avg_rating: Math.round((data.total / data.count) * 10) / 10,
          total_reviews: data.reviews,
        }))
        .sort((a, b) => b.total_reviews - a.total_reviews);

      return new Response(JSON.stringify({
        gas_station_ratings: gasStationRatings,
        facility_ratings: facilityRatings,
        brand_averages: brandAverages,
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
