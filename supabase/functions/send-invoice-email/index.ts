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
  invoiceTitle: string;
  invoiceId: string;
  amount: number;
  dueDate: string;
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
      throw new Error("Only admins and teachers can send invoice emails");
    }

    const body: RequestBody = await req.json();
    const { studentEmail, studentName, className, invoiceTitle, invoiceId, amount, dueDate } = body;

    if (!studentEmail || !studentName || !className || !invoiceTitle || !invoiceId || !dueDate || !Number.isFinite(amount)) {
      throw new Error("Missing required fields for invoice email");
    }

    const formattedAmount = amount.toFixed(2);
    const formattedDueDate = new Date(dueDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const subject = `New Invoice from Future Minds Academy: ${invoiceTitle}`;

    const textBody = `Hello ${studentName},\n\nI hope you are doing well.\n\nA new invoice titled "${invoiceTitle}" has been issued for you at Future Minds Academy. The invoice ID is ${invoiceId}. This invoice is for your class, ${className}, and the total amount due is $${formattedAmount}. Please make sure the payment is completed by ${formattedDueDate}.\n\nIf you have any questions about this invoice or need support with payment, please reply to this email and our finance team will assist you.\n\nWarm regards,\nFuture Minds Academy\nFinance Department`;

    const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#f4f6fb;font-family:Arial,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;background-color:#f4f6fb;">
    <tr>
      <td align="center">
        <table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px;background:#0f172a;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.3;">Future Minds Academy</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hello ${escapeHtml(studentName)},</p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">I hope you are doing well.</p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.7;">
                A new invoice titled "${escapeHtml(invoiceTitle)}" has been issued for you at Future Minds Academy.
                The invoice ID is <strong>${escapeHtml(invoiceId)}</strong>.
                This invoice is for your class, ${escapeHtml(className)}, and the total amount due is <strong>$${formattedAmount}</strong>.
                Please make sure the payment is completed by <strong>${escapeHtml(formattedDueDate)}</strong>.
              </p>
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">
                If you have any questions about this invoice or need support with payment, please reply to this email and our finance team will assist you.
              </p>
              <p style="margin:18px 0 0;font-size:16px;line-height:1.6;">
                Warm regards,<br>
                Future Minds Academy<br>
                Finance Department
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
