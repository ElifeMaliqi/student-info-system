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
  status?: string;
  mode?: "created" | "updated";
  changeSummary?: string;
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
    const { studentEmail, studentName, className, invoiceTitle, invoiceId, amount, dueDate, status, mode, changeSummary } = body;

    if (!studentEmail || !studentName || !className || !invoiceTitle || !invoiceId || !dueDate || !Number.isFinite(amount)) {
      throw new Error("Missing required fields for invoice email");
    }

    const formattedAmount = amount.toFixed(2);
    const formattedDueDate = new Date(dueDate).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    const formattedStatus = (status ?? "not_paid").replace(/_/g, " ");
    const isUpdated = mode === "updated";

    const subject = isUpdated
      ? `Updated Invoice from Future Minds Academy: ${invoiceTitle}`
      : `New Invoice from Future Minds Academy: ${invoiceTitle}`;

    const textBody = isUpdated
      ? `Hello ${studentName},\n\nI hope you are doing well.\n\nYour invoice titled "${invoiceTitle}" has been updated by Future Minds Academy. The change made was: ${changeSummary || "invoice details were updated"}.\n\nThe current invoice details are as follows: invoice ID ${invoiceId}, title "${invoiceTitle}", student name ${studentName}, class ${className}, amount due $${formattedAmount}, due date ${formattedDueDate}, and status ${formattedStatus}.\n\nIf you have any questions about this update or need support with payment, please reply to this email and our finance team will assist you.\n\nWarm regards,\nFuture Minds Academy\nFinance Department`
      : `Hello ${studentName},\n\nI hope you are doing well.\n\nA new invoice titled "${invoiceTitle}" has been issued for you at Future Minds Academy. The invoice ID is ${invoiceId}. This invoice is for your class, ${className}, and the total amount due is $${formattedAmount}. Please make sure the payment is completed by ${formattedDueDate}.\n\nThe current invoice details are as follows: invoice ID ${invoiceId}, title "${invoiceTitle}", student name ${studentName}, class ${className}, amount due $${formattedAmount}, due date ${formattedDueDate}, and status ${formattedStatus}.\n\nIf you have any questions about this invoice or need support with payment, please reply to this email and our finance team will assist you.\n\nWarm regards,\nFuture Minds Academy\nFinance Department`;

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
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:600;letter-spacing:-0.3px;">
                ${escapeHtml(invoiceTitle)}
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:13px;">
                ${isUpdated ? "Future Minds Academy Invoice Update" : "Future Minds Academy Invoice Notification"}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 40px;">
              <div style="color:rgba(255,255,255,0.75);font-size:15px;line-height:1.7;">
                <p style="margin:0 0 16px;">Hello ${escapeHtml(studentName)},</p>
                <p style="margin:0 0 16px;">I hope you are doing well.</p>
                <p style="margin:0 0 16px;">
                  ${isUpdated
                    ? `Your invoice titled "${escapeHtml(invoiceTitle)}" has been updated by Future Minds Academy. The change made was: <strong style="color:#ffffff;">${escapeHtml(changeSummary || "invoice details were updated")}</strong>.`
                    : `A new invoice titled "${escapeHtml(invoiceTitle)}" has been issued for you at Future Minds Academy.`}
                </p>
                <p style="margin:0 0 16px;">
                  The current invoice details are as follows: invoice ID <strong style="color:#ffffff;">${escapeHtml(invoiceId)}</strong>, student name ${escapeHtml(studentName)}, class ${escapeHtml(className)}, amount due <strong style="color:#ffffff;">$${formattedAmount}</strong>, due date <strong style="color:#ffffff;">${escapeHtml(formattedDueDate)}</strong>, and status <strong style="color:#ffffff; text-transform:capitalize;">${escapeHtml(formattedStatus)}</strong>.
                </p>
                <p style="margin:0 0 16px;">
                  If you have any questions about this ${isUpdated ? "update" : "invoice"} or need support with payment, please reply to this email and our finance team will assist you.
                </p>
                <p style="margin:0;">
                  Warm regards,<br>
                  Future Minds Academy<br>
                  Finance Department
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
    console.error("send-invoice-email error:", err);
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
