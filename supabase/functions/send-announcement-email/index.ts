import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET, PUT, DELETE",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

interface RequestBody {
  title: string;
  content: string;
  audience: string;
  programId?: string;
  classId?: string;
  senderName: string;
}

Deno.serve(async (req: Request) => {
  // Always handle CORS preflight requests immediately
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") ?? "Future Minds <info@futureminds.io>";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify caller is admin or teacher
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user: callerUser },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) throw new Error("Unauthorized");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role === "student") {
      throw new Error("Only admins and teachers can send announcement emails");
    }

    const body: RequestBody = await req.json();
    const { title, content, audience, programId, classId, senderName } = body;

    if (!title || !content || !audience) {
      throw new Error("Missing required fields: title, content, audience");
    }

    // Resolve recipient emails based on audience
    const recipientEmails: string[] = [];

    if (audience === "all") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .in("role", ["student", "teacher", "admin"]);
      recipientEmails.push(...(data || []).map((p: any) => p.email).filter(Boolean));
    } else if (audience === "students") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("role", "student");
      recipientEmails.push(...(data || []).map((p: any) => p.email).filter(Boolean));
    } else if (audience === "teachers") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("role", "teacher");
      recipientEmails.push(...(data || []).map((p: any) => p.email).filter(Boolean));
    } else if (audience === "admins") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("role", "admin");
      recipientEmails.push(...(data || []).map((p: any) => p.email).filter(Boolean));
    } else if (audience === "program_specific" && programId) {
      // Get students enrolled in classes belonging to this program
      const { data: classes } = await supabaseAdmin
        .from("classes")
        .select("id")
        .eq("program_id", programId);
      const classIds = (classes || []).map((c: any) => c.id);

      if (classIds.length > 0) {
        const { data: enrollments } = await supabaseAdmin
          .from("class_enrollments")
          .select("student_id")
          .in("class_id", classIds)
          .eq("status", "active");
        const studentIds = [
          ...new Set((enrollments || []).map((e: any) => e.student_id)),
        ];

        if (studentIds.length > 0) {
          const { data: profiles } = await supabaseAdmin
            .from("profiles")
            .select("email")
            .in("id", studentIds);
          recipientEmails.push(
            ...(profiles || []).map((p: any) => p.email).filter(Boolean)
          );
        }
      }
    } else if (audience === "class_specific" && classId) {
      const { data: enrollments } = await supabaseAdmin
        .from("class_enrollments")
        .select("student_id")
        .eq("class_id", classId)
        .eq("status", "active");
      const studentIds = (enrollments || []).map((e: any) => e.student_id);

      if (studentIds.length > 0) {
        const { data: profiles } = await supabaseAdmin
          .from("profiles")
          .select("email")
          .in("id", studentIds);
        recipientEmails.push(
          ...(profiles || []).map((p: any) => p.email).filter(Boolean)
        );
      }
    }

    if (recipientEmails.length === 0) {
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: "No recipients found for this audience" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate
    const uniqueEmails = [...new Set(recipientEmails)];

    const subject = `${title} — ${senderName}`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#111118;border-radius:16px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">
                ${escapeHtml(title)}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
                From ${escapeHtml(senderName)}
              </p>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;white-space:pre-wrap;">${escapeHtml(content)}</div>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">
                Future Minds · Student Information System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    // Send via Resend — batch in groups of 50 (Resend batch limit)
    const batchSize = 50;
    let totalSent = 0;
    const errors: string[] = [];

    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      const batch = uniqueEmails.slice(i, i + batchSize);

      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          batch.map((email) => ({
            from: fromEmail,
            to: [email],
            subject,
            html: htmlBody,
          }))
        ),
      });

      if (res.ok) {
        totalSent += batch.length;
      } else {
        const errBody = await res.text();
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${errBody}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        sent: totalSent,
        total: uniqueEmails.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in send-announcement-email function:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
        errorDetails: err instanceof Error ? err.stack : undefined,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
