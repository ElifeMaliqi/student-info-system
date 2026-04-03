import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

interface RequestBody {
  email: string;
  firstName: string;
  lastName: string;
  parentName: string;
  phone: string;
  /** If provided, identity is verified AND password is changed. */
  newPassword?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body: RequestBody = await req.json();
    const email = (body.email || "").trim().toLowerCase();
    const firstName = (body.firstName || "").trim().toLowerCase();
    const lastName = (body.lastName || "").trim().toLowerCase();
    const parentName = (body.parentName || "").trim().toLowerCase();
    const phone = (body.phone || "").trim().replace(/\s+/g, "");
    const newPassword = body.newPassword;

    if (!email || !firstName || !lastName || !parentName || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Lookup profile by email ----------
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id, first_name, last_name, parent_first_name, phone, secondary_phone, email")
      .eq("email", email)
      .maybeSingle();

    if (profileError || !profile) {
      // Generic message to avoid user-enumeration
      return new Response(
        JSON.stringify({ success: false, error: "Identity verification failed. Please check all fields and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Verify each field ----------
    const dbFirstName = (profile.first_name || "").trim().toLowerCase();
    const dbLastName = (profile.last_name || "").trim().toLowerCase();
    const dbParentName = (profile.parent_first_name || "").trim().toLowerCase();
    const dbPhone = (profile.phone || "").trim().replace(/\s+/g, "");
    const dbSecondaryPhone = (profile.secondary_phone || "").trim().replace(/\s+/g, "");

    const firstNameMatch = firstName === dbFirstName;
    const lastNameMatch = lastName === dbLastName;
    const parentNameMatch = parentName === dbParentName;
    const phoneMatch = phone === dbPhone || phone === dbSecondaryPhone;

    if (!firstNameMatch || !lastNameMatch || !parentNameMatch || !phoneMatch) {
      return new Response(
        JSON.stringify({ success: false, error: "Identity verification failed. Please check all fields and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Identity verified ----------

    // If newPassword is supplied, change it
    if (newPassword) {
      if (newPassword.length < 6) {
        return new Response(
          JSON.stringify({ success: false, error: "New password must be at least 6 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the auth user by email
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      if (listError) throw listError;

      const authUser = (listData?.users || []).find(
        (u: { email?: string }) => (u.email || "").toLowerCase() === email
      );

      if (!authUser) {
        return new Response(
          JSON.stringify({ success: false, error: "Could not locate authentication record." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
        password: newPassword,
      });

      if (updateError) throw updateError;

      // Clear must_change_password flag
      await supabaseAdmin
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", profile.id);

      return new Response(
        JSON.stringify({ success: true, passwordChanged: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify-only mode
    return new Response(
      JSON.stringify({ success: true, verified: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-identity-reset-password error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
