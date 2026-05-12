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
  title: string;
  content: string;
  audience: string;
  programId?: string;
  classId?: string;
  senderName: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("send-announcement-sms: request received", {
      method: req.method,
      hasAuthHeader: Boolean(req.headers.get("Authorization")),
    });

    // ── Twilio credentials (set these as Supabase secrets) ──────────
    const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuth = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFrom = Deno.env.get("TWILIO_FROM_NUMBER"); // e.g. "+1234567890" or "FutureMinds" (alphanumeric sender ID)

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

    // ── Auth: only admins & teachers ────────────────────────────────
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
      throw new Error("Only admins and teachers can send announcement SMS");
    }

    // ── Parse body ──────────────────────────────────────────────────
    const body: RequestBody = await req.json();
    const { title, content, audience, programId, classId, senderName } = body;

    if (!title || !content || !audience) {
      throw new Error("Missing required fields: title, content, audience");
    }

    // ── Resolve recipient phone numbers based on audience ───────────
    const phones: string[] = [];

    if (audience === "all") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .in("role", ["student", "teacher", "admin"]);
      phones.push(...(data || []).map((p: any) => p.phone).filter(Boolean));
    } else if (audience === "students") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("role", "student");
      phones.push(...(data || []).map((p: any) => p.phone).filter(Boolean));
    } else if (audience === "teachers") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("role", "teacher");
      phones.push(...(data || []).map((p: any) => p.phone).filter(Boolean));
    } else if (audience === "admins") {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("phone")
        .eq("role", "admin");
      phones.push(...(data || []).map((p: any) => p.phone).filter(Boolean));
    } else if (audience === "program_specific" && programId) {
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
            .select("phone")
            .in("id", studentIds);
          phones.push(
            ...(profiles || []).map((p: any) => p.phone).filter(Boolean)
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
          .select("phone")
          .in("id", studentIds);
        phones.push(
          ...(profiles || []).map((p: any) => p.phone).filter(Boolean)
        );
      }
    }

    if (phones.length === 0) {
      console.log("send-announcement-sms: no recipients with phone", { audience });
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: "No recipients with phone numbers found for this audience",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deduplicate & normalise
    const uniquePhones = [...new Set(phones.map(normalizePhone).filter(Boolean))];
    console.log("send-announcement-sms: recipients resolved", {
      audience,
      rawCount: phones.length,
      uniqueCount: uniquePhones.length,
    });

    // ── Fetch SMS template from DB (falls back to built-in default) ────────────
    const { data: tplRow } = await supabaseAdmin
      .from("message_templates")
      .select("sms_body")
      .eq("type", "announcement")
      .single();

    const defaultTemplate =
      `Future Minds Academy\n\n{{title}}\n\n{{content}}\n\n— {{senderName}}\n\nIf you have any questions, please contact us and our team will assist you.`;
    const template = tplRow?.sms_body ?? defaultTemplate;

    // Truncate long content to keep the total message reasonable
    const truncatedContent =
      content.length > 400 ? content.slice(0, 397) + "…" : content;

    const smsBody = interpolate(template, {
      title,
      content: truncatedContent,
      senderName,
    });

    // ── Send via Twilio Messages API ────────────────────────────────
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;
    const authB64 = btoa(`${twilioSid}:${twilioAuth}`);

    let totalSent = 0;
    const errors: string[] = [];

    for (const phone of uniquePhones) {
      try {
        const res = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: `Basic ${authB64}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            From: twilioFrom,
            To: phone,
            Body: smsBody,
          }).toString(),
        });

        if (res.ok) {
          totalSent++;
        } else {
          const errBody = await res.text();
          console.error("send-announcement-sms: twilio request failed", {
            phone,
            status: res.status,
            statusText: res.statusText,
            body: errBody,
          });
          errors.push(`${phone}: ${errBody}`);
        }
      } catch (fetchErr) {
        console.error("send-announcement-sms: twilio fetch exception", {
          phone,
          error: fetchErr instanceof Error ? fetchErr.message : "fetch failed",
        });
        errors.push(`${phone}: ${fetchErr instanceof Error ? fetchErr.message : "fetch failed"}`);
      }
    }

    console.log("send-announcement-sms: completed", {
      sent: totalSent,
      total: uniquePhones.length,
      hasErrors: errors.length > 0,
    });

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        sent: totalSent,
        total: uniquePhones.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error in send-announcement-sms function:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

/** Normalise phone to E.164-ish format for Twilio */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^+\d]/g, "");
  // Already has country code
  if (digits.startsWith("+")) return digits;
  // Kosovo numbers: 04x xxx xxx → +383 4x xxx xxx
  if (digits.startsWith("0")) return "+383" + digits.slice(1);
  // Already bare international (383...)
  if (digits.startsWith("383")) return "+" + digits;
  return "+" + digits;
}

/** Replace {{variable}} placeholders with values from a record. */
function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}
