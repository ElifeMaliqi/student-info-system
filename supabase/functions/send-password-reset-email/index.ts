import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

interface RequestBody {
  email: string;
  redirectTo: string;
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

    const { email, redirectTo }: RequestBody = await req.json();
    const normalizedEmail = (email || "").trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      throw new Error("Valid email is required");
    }

    const safeRedirectTo = (redirectTo || "").trim();
    if (!safeRedirectTo) {
      throw new Error("redirectTo is required");
    }

    let resetLink: string | null = null;
    let firstName = "there";

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profile?.first_name) firstName = profile.first_name;

    try {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: normalizedEmail,
        options: {
          redirectTo: safeRedirectTo,
        },
      });

      if (!error) {
        const props = (data as { properties?: { action_link?: string } })?.properties;
        resetLink = props?.action_link ?? null;
      }
    } catch {
      // Keep response generic to avoid user enumeration.
    }

    if (resetLink) {
      const subject = "Reset Your Password - Future Minds Academy";

      const textBody = `Hello ${firstName},\n\nWe received a request to reset your password for your Future Minds Academy account.\n\nUse this secure link to reset your password:\n${resetLink}\n\nThis link will expire automatically. If you did not request a password reset, you can safely ignore this message.\n\nWarm regards,\nFuture Minds Academy\nSupport Team`;

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
            <td style="background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);padding:32px 40px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">Reset Your Password</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Future Minds Academy Account Security</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
                <p style="margin:0 0 16px;">Hello ${escapeHtml(firstName)},</p>
                <p style="margin:0 0 16px;">We received a request to reset your password for your Future Minds Academy account.</p>
                <p style="margin:0 0 22px;">Click the button below to set a new password:</p>
                <p style="margin:0 0 22px;">
                  <a href="${escapeHtmlAttr(resetLink)}" style="display:inline-block;background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-weight:600;">Reset Password</a>
                </p>
                <p style="margin:0 0 16px;">If the button does not work, copy and paste this link into your browser:</p>
                <p style="margin:0 0 16px;word-break:break-all;">
                  <a href="${escapeHtmlAttr(resetLink)}" style="color:#b5b9ff;">${escapeHtml(resetLink)}</a>
                </p>
                <p style="margin:0;">If you did not request a password reset, you can safely ignore this message.</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px 28px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(255,255,255,0.25);font-size:11px;text-align:center;">Future Minds Academy · Student Information System</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [normalizedEmail],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 400,
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

function escapeHtmlAttr(str: string): string {
  return escapeHtml(str).replace(/`/g, "&#096;");
}
