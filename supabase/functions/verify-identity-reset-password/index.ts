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
  /** The one-time access token issued by send-reset-access-code */
  accessToken: string;
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
    const accessToken = (body.accessToken || "").trim();
    const newPassword = body.newPassword;

    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or missing reset link. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!email || !firstName || !lastName || !parentName || !phone) {
      return new Response(
        JSON.stringify({ success: false, error: "All fields are required." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Validate the access token ----------
    const { data: tokenRow, error: tokenError } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("id, email, expires_at, used, failed_attempts, locked")
      .eq("token", accessToken)
      .maybeSingle();

    if (tokenError || !tokenRow) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired reset link. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if token is locked due to too many failed attempts
    if (tokenRow.locked) {
      return new Response(
        JSON.stringify({ success: false, error: "Too many failed attempts. Please request a new password reset link." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } }
      );
    }

    if (tokenRow.used) {
      return new Response(
        JSON.stringify({ success: false, error: "This reset link has already been used. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (new Date(tokenRow.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ success: false, error: "This reset link has expired. Please request a new one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Token email must match the email in the form
    if ((tokenRow.email as string).toLowerCase() !== email) {
      return new Response(
        JSON.stringify({ success: false, error: "Identity verification failed. Please check all fields and try again." }),
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
      // Increment failed attempt on failed lookup
      const newAttempts = (tokenRow.failed_attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;
      
      await supabaseAdmin
        .from("password_reset_tokens")
        .update({ failed_attempts: newAttempts, locked: shouldLock })
        .eq("id", tokenRow.id);

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
      const newAttempts = (tokenRow.failed_attempts || 0) + 1;
      const shouldLock = newAttempts >= 5;

      await supabaseAdmin
        .from("password_reset_tokens")
        .update({ failed_attempts: newAttempts, locked: shouldLock })
        .eq("id", tokenRow.id);

      if (shouldLock) {
        return new Response(
          JSON.stringify({ success: false, error: "Too many failed attempts. Please request a new password reset link." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" } }
        );
      }

      return new Response(
        JSON.stringify({ success: false, error: "Identity verification failed. Please check all fields and try again." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- Identity verified ----------

    // If newPassword is supplied, change it
    if (newPassword) {
      if (newPassword.length < 8) {
        return new Response(
          JSON.stringify({ success: false, error: "New password must be at least 8 characters." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Find the auth user by email (direct lookup instead of scanning all users)
      const { data: authUser, error: lookupError } = await supabaseAdmin.auth.admin.getUserByEmail(email);
      if (lookupError || !authUser) {
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

      // Mark token as used — it is now permanently invalid
      await supabaseAdmin
        .from("password_reset_tokens")
        .update({ used: true })
        .eq("token", accessToken);

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
    return new Response(
      JSON.stringify({ success: false, error: "An error occurred. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
