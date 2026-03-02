import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: adminUser }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !adminUser) {
      throw new Error("Unauthorized");
    }

    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", adminUser.id)
      .maybeSingle();

    if (adminProfile?.role !== "admin") {
      throw new Error("Only admins can approve registrations");
    }

    const { applicationId } = await req.json();

    if (!applicationId) {
      throw new Error("Application ID is required");
    }

    const { data: app, error: appError } = await supabaseAdmin
      .from("registration_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();

    if (appError || !app) {
      throw new Error("Application not found");
    }

    const { data: authUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: app.email,
      password: app.password_hash,
      email_confirm: true,
      user_metadata: {
        first_name: app.first_name,
        last_name: app.last_name,
      },
      app_metadata: {
        role: app.role,
      },
    });

    if (createUserError) {
      throw new Error(`Failed to create user: ${createUserError.message}`);
    }

    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", authUser.user.id)
      .maybeSingle();

    if (existingProfile) {
      const { error: updateProfileError } = await supabaseAdmin
        .from("profiles")
        .update({
          first_name: app.first_name,
          last_name: app.last_name,
          role: app.role,
          phone: app.phone,
        })
        .eq("id", authUser.user.id);

      if (updateProfileError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to update profile: ${updateProfileError.message}`);
      }
    } else {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: authUser.user.id,
          email: app.email,
          first_name: app.first_name,
          last_name: app.last_name,
          role: app.role,
          phone: app.phone,
        });

      if (profileError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create profile: ${profileError.message}`);
      }
    }

    if (app.role === "student") {
      let programId = null;

      if (app.program) {
        const { data: program } = await supabaseAdmin
          .from("programs")
          .select("id")
          .eq("name", app.program)
          .maybeSingle();

        programId = program?.id;
      }

      const { error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          user_id: authUser.user.id,
          program_id: programId,
          date_of_birth: app.date_of_birth,
          address: app.address,
          city: app.city,
          country: app.country,
          emergency_contact_name: app.emergency_contact_name,
          emergency_contact_phone: app.emergency_contact_phone,
          status: "active",
        });

      if (studentError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create student record: ${studentError.message}`);
      }
    } else if (app.role === "teacher") {
      const { error: teacherError } = await supabaseAdmin
        .from("teachers")
        .insert({
          user_id: authUser.user.id,
          specialization: app.specialization,
          qualifications: app.qualifications,
          experience_years: app.experience_years,
          status: "active",
        });

      if (teacherError) {
        await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
        throw new Error(`Failed to create teacher record: ${teacherError.message}`);
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from("registration_applications")
      .update({
        status: "approved",
        reviewed_by: adminUser.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", applicationId);

    if (updateError) {
      throw new Error(`Failed to update application: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Application approved successfully",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error in approve-registration:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        details: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
