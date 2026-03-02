import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
      .single();

    if (adminProfile?.role !== "admin") {
      throw new Error("Only admins can approve registrations");
    }

    const { applicationId } = await req.json();

    if (!applicationId) {
      throw new Error("Application ID is required");
    }

    const { data: app, error: fetchError } = await supabaseAdmin
      .from("registration_applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (fetchError || !app) {
      throw new Error("Application not found");
    }

    if (app.status !== "pending") {
      throw new Error(`Application already ${app.status}`);
    }

    const { data: existingUser } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", app.email)
      .maybeSingle();

    if (existingUser) {
      throw new Error("User with this email already exists");
    }

    const { data: authData, error: createAuthError } = await supabaseAdmin.auth.admin.createUser({
      email: app.email,
      password: app.password_hash,
      email_confirm: true,
    });

    if (createAuthError || !authData.user) {
      throw new Error(`Failed to create auth user: ${createAuthError?.message}`);
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: userId,
        email: app.email,
        first_name: app.first_name,
        last_name: app.last_name,
        role: app.role,
        phone: app.phone,
        date_of_birth: app.date_of_birth,
        address: app.address,
        city: app.city,
        country: app.country,
        emergency_contact_name: app.emergency_contact_name,
        emergency_contact_phone: app.emergency_contact_phone,
        specialization: app.specialization,
        qualifications: app.qualifications,
        experience_years: app.experience_years,
        parent_first_name: app.parent_first_name,
        id_document_url: app.id_document_url,
        program: app.program,
      });

    if (profileError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    if (app.role === "student") {
      let programId = null;

      if (app.program) {
        const { data: program } = await supabaseAdmin
          .from("programs")
          .select("id")
          .ilike("name", `%${app.program}%`)
          .maybeSingle();

        programId = program?.id;
      }

      const { error: studentError } = await supabaseAdmin
        .from("students")
        .insert({
          user_id: userId,
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
        await supabaseAdmin.auth.admin.deleteUser(userId);
        throw new Error(`Failed to create student record: ${studentError.message}`);
      }
    }

    if (app.role === "teacher") {
      let programId = null;

      if (app.program) {
        const { data: program } = await supabaseAdmin
          .from("programs")
          .select("id")
          .ilike("name", `%${app.program}%`)
          .maybeSingle();

        programId = program?.id;
      }

      if (programId) {
        const { error: teacherProgramError } = await supabaseAdmin
          .from("teacher_programs")
          .insert({
            teacher_id: userId,
            program_id: programId,
          });

        if (teacherProgramError) {
          console.error("Failed to assign teacher to program:", teacherProgramError.message);
        }
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
      console.error("Failed to update application status:", updateError.message);
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
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error approving registration:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 400,
      }
    );
  }
});
