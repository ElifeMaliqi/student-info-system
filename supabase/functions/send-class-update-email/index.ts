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
  className: string;
  originalDate: string;
  /** "rescheduled" | "cancelled" */
  updateType: string;
  newDate?: string;
  newStartTime?: string;
  newEndTime?: string;
  reason?: string;
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
      throw new Error("Only admins and teachers can send class update emails");
    }

    const body: RequestBody = await req.json();
    const { studentEmail, studentName, className, originalDate, updateType, newDate, newStartTime, newEndTime, reason } = body;

    if (!studentEmail || !studentName || !className || !originalDate || !updateType) {
      throw new Error("Missing required fields for class update email");
    }

    const isCancelled = updateType === "cancelled";

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

    const formattedOriginal = fmtDate(originalDate);
    const formattedNew = newDate ? fmtDate(newDate) : null;
    const newTime = newStartTime && newEndTime
      ? `${newStartTime} – ${newEndTime}`
      : newStartTime ?? null;

    const subject = isCancelled
      ? `Class Cancelled: ${className} | Future Minds Academy`
      : `Class Rescheduled: ${className} | Future Minds Academy`;

    const textBody = isCancelled
      ? `Hello ${studentName},\n\nWe want to inform you that your class "${className}" scheduled for ${formattedOriginal} has been cancelled.${reason ? `\n\nReason: ${reason}` : ""}\n\nIf you have any questions about this change, please contact us and our team will assist you.\n\nWarm regards,\nFuture Minds Academy`
      : `Hello ${studentName},\n\nWe want to inform you that your class "${className}" originally scheduled for ${formattedOriginal} has been rescheduled.${formattedNew ? `\n\nNew date: ${formattedNew}` : ""}${newTime ? `\nNew time: ${newTime}` : ""}${reason ? `\n\nReason: ${reason}` : ""}\n\nIf you have any questions about this change, please contact us and our team will assist you.\n\nWarm regards,\nFuture Minds Academy`;

    const accentColor = isCancelled ? "#ef4444" : "#fc0ce4";
    const headerLabel = isCancelled ? "Class Cancellation" : "Class Reschedule";

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
          <tr>
            <td style="background:linear-gradient(135deg,${accentColor} 0%,#949ce4 100%);padding:32px 40px;">
              <p style="margin:0 0 6px;color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:1.5px;">
                ${headerLabel}
              </p>
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">
                ${escapeHtml(className)}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">
                Future Minds Academy
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
                <p style="margin:0 0 16px;">Hello ${escapeHtml(studentName)},</p>
                <p style="margin:0 0 16px;">
                  ${isCancelled
                    ? `We want to inform you that your class <strong style="color:#ffffff;">${escapeHtml(className)}</strong> scheduled for <strong style="color:#ffffff;">${escapeHtml(formattedOriginal)}</strong> has been <strong style="color:${accentColor};">cancelled</strong>.`
                    : `We want to inform you that your class <strong style="color:#ffffff;">${escapeHtml(className)}</strong> originally scheduled for <strong style="color:#ffffff;">${escapeHtml(formattedOriginal)}</strong> has been <strong style="color:${accentColor};">rescheduled</strong>.`}
                </p>
                ${!isCancelled && (formattedNew || newTime) ? `
                <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
                  <tr>
                    <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:10px;padding:18px 20px;">
                      ${formattedNew ? `<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;font-weight:600;">New Date</p>
                      <p style="margin:0 0 14px;font-size:16px;font-weight:600;color:#ffffff;">${escapeHtml(formattedNew)}</p>` : ""}
                      ${newTime ? `<p style="margin:0 0 8px;font-size:13px;color:rgba(255,255,255,0.4);text-transform:uppercase;letter-spacing:1px;font-weight:600;">New Time</p>
                      <p style="margin:0;font-size:16px;font-weight:600;color:#ffffff;">${escapeHtml(newTime)}</p>` : ""}
                    </td>
                  </tr>
                </table>` : ""}
                ${reason ? `<p style="margin:0 0 16px;padding:14px 18px;background:rgba(255,255,255,0.04);border-left:3px solid ${accentColor};border-radius:0 8px 8px 0;font-size:14px;color:rgba(255,255,255,0.65);">
                  <strong style="color:#ffffff;display:block;margin-bottom:4px;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Reason</strong>
                  ${escapeHtml(reason)}
                </p>` : ""}
                <p style="margin:0 0 16px;">
                  If you have any questions about this change, please contact us and our team will assist you.
                </p>
                <p style="margin:0;">
                  Warm regards,<br>
                  Future Minds Academy
                </p>
              </div>
            </td>
          </tr>
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
    console.error("send-class-update-email error:", err);
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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
