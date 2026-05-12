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
  studentPhone: string;
  studentName: string;
  examName: string;
  className: string;
  teacherName: string;
  oldPoints: number;
  oldPassed: boolean;
  newPoints: number;
  newPassed: boolean;
  note?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!twilioSid || !twilioAuth || !twilioFrom) {
      throw new Error(
        "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER as secrets."
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Auth: only admins & teachers
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: authError } =
      await supabaseAdmin.auth.getUser(token);
    if (authError || !callerUser) throw new Error("Unauthorized");

    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", callerUser.id)
      .single();

    if (!callerProfile || callerProfile.role === "student") {
      throw new Error("Only admins and teachers can send grade SMS");
    }

    const body: RequestBody = await req.json();
    const {
      studentPhone, studentName, examName, className, teacherName,
      oldPoints, oldPassed, newPoints, newPassed, note,
    } = body;

    if (
      !studentPhone || !studentName || !examName || !className || !teacherName ||
      !Number.isFinite(oldPoints) || typeof oldPassed !== "boolean" ||
      !Number.isFinite(newPoints) || typeof newPassed !== "boolean"
    ) {
      throw new Error("Missing required fields for grade-changed SMS");
    }

    // Fetch template from DB
    const { data: tplRow } = await supabaseAdmin
      .from("message_templates")
      .select("sms_body")
      .eq("type", "grade_changed")
      .single();

    const defaultTemplate =
      `Future Minds Academy — Grade Correction\n\nHi {{studentName}},\n\nYour grade for "{{examName}}" in {{className}} has been revised.\n\nPrevious: {{oldPoints}}/100 ({{oldResult}})\nNew:      {{newPoints}}/100 ({{newResult}}){{noteSection}}\n\nTeacher: {{teacherName}}\n\nIf you have any questions about this correction, please contact us and our team will assist you.`;

    const template = tplRow?.sms_body ?? defaultTemplate;

    const noteSection = note ? `\nNote: ${note}` : "";

    const smsBody = interpolate(template, {
      studentName,
      examName,
      className,
      teacherName,
      oldPoints: String(oldPoints),
      oldResult: oldPassed ? "Passed" : "Failed",
      newPoints: String(newPoints),
      newResult: newPassed ? "Passed" : "Failed",
      noteSection,
    });

    const normalizedPhone = normalizePhone(studentPhone);
    if (!normalizedPhone) {
      throw new Error(`Invalid phone number: ${studentPhone}`);
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const authB64 = btoa(`${twilioSid}:${twilioAuth}`);

    const res = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authB64}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        From: twilioFrom,
        To: normalizedPhone,
        Body: smsBody,
      }).toString(),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Twilio error: ${res.status} ${errBody}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in send-grade-changed-sms:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^+\d]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("0")) return "+383" + digits.slice(1);
  if (digits.startsWith("383")) return "+" + digits;
  return "+" + digits;
}

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
