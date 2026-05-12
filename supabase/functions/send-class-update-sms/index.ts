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

    // Auth: only admins / teachers
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
      throw new Error("Only admins and teachers can send class update SMS");
    }

    const body: RequestBody = await req.json();
    const { studentPhone, studentName, className, originalDate, updateType, newDate, newStartTime, newEndTime, reason } = body;

    if (!studentPhone || !studentName || !className || !originalDate || !updateType) {
      throw new Error("Missing required fields for class update SMS");
    }

    // Fetch template from DB
    const { data: tplRow } = await supabaseAdmin
      .from("message_templates")
      .select("sms_body")
      .eq("type", "class_update")
      .single();

    const defaultTemplate =
      `Future Minds Academy — Class Update\n\nHi {{studentName}},\n\nYour class "{{className}}" originally scheduled for {{originalDate}} has been {{updateType}}.{{newScheduleSection}}{{reasonSection}}\n\nIf you have any questions about this change, please contact us and our team will assist you.`;

    const template = tplRow?.sms_body ?? defaultTemplate;

    const fmtDate = (iso: string) =>
      new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });

    const formattedOriginal = fmtDate(originalDate);
    const newTime = newStartTime && newEndTime ? `${newStartTime} – ${newEndTime}` : newStartTime ?? "";
    const newScheduleSection = updateType === "rescheduled" && newDate
      ? `\n\nNew date: ${fmtDate(newDate)}${newTime ? `\nNew time: ${newTime}` : ""}`
      : "";
    const reasonSection = reason ? `\nReason: ${reason}` : "";

    const smsBody = interpolate(template, {
      studentName,
      className,
      originalDate: formattedOriginal,
      newScheduleSection,
      reasonSection,
      updateType,
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
    console.error("Error in send-class-update-sms:", err);
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
