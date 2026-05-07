import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

interface RequestBody {
  studentEmail: string;
  studentName: string;
  examName: string;
  className: string;
  teacherName: string;
  totalPoints: number;
  passed: boolean;
  note?: string;
  mode: "submitted" | "updated";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "info@futureminds.io";
    const fromEmail = `Future Minds Academy <${extractEmail(rawFrom)}>`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) throw new Error("Unauthorized");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role === "student") {
      throw new Error("Only admins and teachers can send grade emails");
    }

    const body: RequestBody = await req.json();
    const { studentEmail, studentName, examName, className, teacherName, totalPoints, passed, note, mode } = body;

    if (!studentEmail || !studentName || !examName || !className || !teacherName || !Number.isFinite(totalPoints) || typeof passed !== "boolean") {
      throw new Error("Missing required fields for grade email");
    }

    const isUpdated = mode === "updated";
    const resultLabel = passed ? "Passed" : "Failed";
    const resultColor = passed ? "#10b981" : "#ef4444";

    const subject = isUpdated
      ? `Grade Updated – ${examName} | Future Minds Academy`
      : `Your Grade is Ready – ${examName} | Future Minds Academy`;

    const textBody = isUpdated
      ? `Hello ${studentName},\n\nYour grade for the exam "${examName}" in ${className} has been updated by ${teacherName}.\n\nResult: ${resultLabel}\nPoints: ${totalPoints}/100${note ? `\nNote from teacher: ${note}` : ""}\n\nIf you have any questions, please contact your teacher or the academy administration.\n\nWarm regards,\nFuture Minds Academy`
      : `Hello ${studentName},\n\nYour exam "${examName}" in ${className} has been graded by ${teacherName}.\n\nResult: ${resultLabel}\nPoints: ${totalPoints}/100${note ? `\nNote from teacher: ${note}` : ""}\n\nIf you have any questions, please contact your teacher or the academy administration.\n\nWarm regards,\nFuture Minds Academy`;

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
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">
                ${isUpdated ? "Grade Update" : "Grade Notification"}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ${escapeHtml(examName)}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                ${escapeHtml(className)} · Graded by ${escapeHtml(teacherName)}
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
                <p style="margin:0 0 20px;">Hello <strong style="color:#ffffff;">${escapeHtml(studentName)}</strong>,</p>

                <p style="margin:0 0 24px;">
                  ${isUpdated
                    ? `Your grade for <strong style="color:#ffffff;">${escapeHtml(examName)}</strong> has been <strong style="color:#ffffff;">updated</strong>.`
                    : `Your exam <strong style="color:#ffffff;">${escapeHtml(examName)}</strong> has been graded.`
                  }
                </p>

                <!-- Result card -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);margin-bottom:24px;">
                  <tr>
                    <td style="padding:20px 24px;">
                      <table width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <span style="color:rgba(255,255,255,0.4);font-size:12px;">Result</span>
                          </td>
                          <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">
                            <span style="color:${resultColor};font-weight:700;font-size:14px;">
                              ${resultLabel}
                            </span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <span style="color:rgba(255,255,255,0.4);font-size:12px;">Points</span>
                          </td>
                          <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">
                            <span style="color:#ffffff;font-weight:700;font-size:14px;">${totalPoints}<span style="color:rgba(255,255,255,0.3);font-weight:400;"> / 100</span></span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <span style="color:rgba(255,255,255,0.4);font-size:12px;">Class</span>
                          </td>
                          <td style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">
                            <span style="color:rgba(255,255,255,0.8);font-size:13px;">${escapeHtml(className)}</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:6px 0;">
                            <span style="color:rgba(255,255,255,0.4);font-size:12px;">Teacher</span>
                          </td>
                          <td style="padding:6px 0;text-align:right;">
                            <span style="color:rgba(255,255,255,0.8);font-size:13px;">${escapeHtml(teacherName)}</span>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>

                ${note ? `
                <!-- Teacher note -->
                <table width="100%" cellpadding="0" cellspacing="0" style="background-color:rgba(252,12,228,0.07);border-radius:10px;border:1px solid rgba(252,12,228,0.18);margin-bottom:24px;">
                  <tr>
                    <td style="padding:16px 20px;">
                      <p style="margin:0 0 6px;color:rgba(252,12,228,0.8);font-size:11px;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Note from teacher</p>
                      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:14px;line-height:1.6;">${escapeHtml(note)}</p>
                    </td>
                  </tr>
                </table>
                ` : ""}

                <p style="margin:0;">
                  If you have any questions about your grade, please reach out to your teacher or the academy administration.<br><br>
                  Warm regards,<br>
                  <strong style="color:#ffffff;">Future Minds Academy</strong><br>
                  <span style="color:rgba(255,255,255,0.4);font-size:13px;">Academic Department</span>
                </p>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">
                Future Minds Academy · Student Information System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [studentEmail],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resendResp.ok) {
      const err = await resendResp.text();
      throw new Error(`Resend error: ${err}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-grade-email error:", err);
    return new Response(JSON.stringify({ success: false, error: "An error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractEmail(input: string): string {
  const match = input.match(/<([^>]+)>/);
  return (match?.[1] || input).trim();
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
