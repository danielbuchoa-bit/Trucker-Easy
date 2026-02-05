 import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
 
 const corsHeaders = {
   "Access-Control-Allow-Origin": "*",
   "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
 };
 
 Deno.serve(async (req) => {
   if (req.method === "OPTIONS") {
     return new Response(null, { headers: corsHeaders });
   }
 
   try {
    const { email, password, phone, full_name, tier, update_password } = await req.json();
 
     // Validate required fields
     if (!email || !password) {
       return new Response(
         JSON.stringify({ error: "Email and password are required" }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     // Create admin client with service role
     const supabaseAdmin = createClient(
       Deno.env.get("SUPABASE_URL") ?? "",
       Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
       { auth: { autoRefreshToken: false, persistSession: false } }
     );
 
    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    // If update_password is true and user exists, just update password
    if (update_password && existingUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        existingUser.id,
        { password }
      );

      if (updateError) {
        return new Response(
          JSON.stringify({ error: updateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          user_id: existingUser.id,
          email,
          message: "Password updated successfully",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

     // Create the user using admin API (phone is stored in metadata, not as auth phone)
     const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
       email,
       password,
       email_confirm: true, // Auto-confirm email
       user_metadata: {
         full_name: full_name || email.split("@")[0]
       },
     });
 
     if (userError) {
       console.error("Error creating user:", userError);
       return new Response(
         JSON.stringify({ error: userError.message }),
         { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
       );
     }
 
     const userId = userData.user.id;
 
     // Update the profile with phone number
     if (phone) {
       await supabaseAdmin.from("profiles").update({ phone }).eq("id", userId);
     }
 
     // Create subscription if tier is specified
     if (tier && tier !== "none") {
       const { error: subError } = await supabaseAdmin.from("subscriptions").insert({
         user_id: userId,
         provider: "demo",
         status: "active",
         plan_tier: tier,
         current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
         source_id: `demo_${userId}`,
       });
 
       if (subError) {
         console.error("Error creating subscription:", subError);
         // User was created, just log the subscription error
       }
     }
 
     return new Response(
       JSON.stringify({
         success: true,
         user_id: userId,
         email,
         tier,
         message: `Account created successfully with ${tier || "no"} subscription`,
       }),
       { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   } catch (error: unknown) {
     console.error("Unexpected error:", error);
     return new Response(
       JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
       { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
     );
   }
 });