import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  // Always return success to prevent user enumeration
  const ok = new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) return ok;

    const rawFrom = Deno.env.get("RESEND_FROM_EMAIL") ?? "info@futureminds.io";
    const fromEmail = `Future Minds Academy <${extractEmail(rawFrom)}>`;
    const siteUrl =
      Deno.env.get("SITE_URL") ?? "https://studentinfosystems.netlify.app";

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const body = await req.json().catch(() => ({}));
    const normalizedEmail = ((body.email as string) || "").trim().toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) return ok;

    // Check if this email belongs to any profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("first_name")
      .eq("email", normalizedEmail)
      .maybeSingle();

    // Don't reveal whether the email exists — just return ok silently
    if (!profile) return ok;

    // Generate a cryptographically secure 64-char hex token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Delete all existing tokens for this email (allow only one active token)
    await supabaseAdmin
      .from("password_reset_tokens")
      .delete()
      .eq("email", normalizedEmail);

    // Insert new token — expires in 1 hour
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const { error: insertError } = await supabaseAdmin
      .from("password_reset_tokens")
      .insert({ token, email: normalizedEmail, expires_at: expiresAt });

    if (insertError) {
      console.error("Failed to insert token:", insertError);
      return ok;
    }

    const resetLink = `${siteUrl}/resetpassword?t=${token}`;
    const firstName = profile.first_name ?? "there";

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
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">Password Reset Request</h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Future Minds Academy · Account Security</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
                <p style="margin:0 0 16px;">Hello ${escapeHtml(firstName)},</p>
                <p style="margin:0 0 16px;">We received a request to reset the password for your Future Minds Academy account. Click the secure button below to proceed — you will be asked to verify your identity first.</p>
                <p style="margin:0 0 24px;">
                  <a href="${escapeHtmlAttr(resetLink)}"
                    style="display:inline-block;background:linear-gradient(135deg,#fc0ce4 0%,#949ce4 100%);color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-weight:600;font-size:14px;">
                    Reset My Password
                  </a>
                </p>
                <p style="margin:0 0 8px;color:rgba(255,255,255,0.5);font-size:13px;">This link expires in <strong style="color:rgba(255,255,255,0.75);">1 hour</strong> and can only be used once.</p>
                <p style="margin:0 0 16px;color:rgba(255,255,255,0.5);font-size:13px;">If the button does not work, copy and paste this URL into your browser:</p>
                <p style="margin:0 0 16px;word-break:break-all;">
                  <a href="${escapeHtmlAttr(resetLink)}" style="color:#b5b9ff;font-size:12px;">${escapeHtml(resetLink)}</a>
                </p>
                <p style="margin:16px 0 0;padding:16px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid rgba(252,12,228,0.5);color:rgba(255,255,255,0.5);font-size:12px;">
                  If you did not request this, you can safely ignore this email. Your password will not change.
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

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [normalizedEmail],
        subject: "Password Reset Access — Future Minds Academy",
        html: htmlBody,
      }),
    });

    return ok;
  } catch (err) {
    console.error("send-reset-access-code error:", err);
    // Always return ok to avoid leaking information
    return ok;
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

function escapeHtmlAttr(str: string): string {
  return str.replace(/"/g, "&quot;");
}

function extractEmail(input: string): string {
  const match = input.match(/<([^>]+)>/);
  return (match?.[1] || input).trim();
}
