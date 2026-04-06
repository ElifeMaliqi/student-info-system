import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-client-info, x-supabase-auth",
  "Access-Control-Max-Age": "86400",
};

interface ValidationRequest {
  fileName: string;
  fileMimeType: string;
  fileSize: number;
  base64Content: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: ValidationRequest = await req.json();
    const { fileName, fileMimeType, fileSize, base64Content } = body;

    // Decode base64 to get file bytes for magic byte validation
    const binaryString = atob(base64Content);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Allowed MIME types and their magic bytes
    const allowedTypes: Record<string, { mimeType: string; magicBytes: number[][] }> = {
      pdf: { mimeType: "application/pdf", magicBytes: [[0x25, 0x50, 0x44, 0x46]] }, // %PDF
      jpeg: { mimeType: "image/jpeg", magicBytes: [[0xff, 0xd8, 0xff]] }, // JPEG SOI marker
      png: { mimeType: "image/png", magicBytes: [[0x89, 0x50, 0x4e, 0x47]] }, // PNG signature
      jpg: { mimeType: "image/jpeg", magicBytes: [[0xff, 0xd8, 0xff]] }, // JPEG SOI marker (alternative extension)
    };

    // Validate file size (5 MB max)
    const maxSize = 5 * 1024 * 1024;
    if (fileSize > maxSize) {
      return new Response(
        JSON.stringify({ success: false, error: "File size exceeds maximum of 5MB" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get file extension
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const allowedType = allowedTypes[ext];

    if (!allowedType) {
      return new Response(
        JSON.stringify({ success: false, error: "File type not allowed. Use PDF, JPEG, or PNG." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate magic bytes: check if file starts with expected bytes
    let isValidMagic = false;
    for (const magicBytes of allowedType.magicBytes) {
      if (bytes.length >= magicBytes.length) {
        const fileHeader = Array.from(bytes.slice(0, magicBytes.length));
        if (fileHeader.every((byte, idx) => byte === magicBytes[idx])) {
          isValidMagic = true;
          break;
        }
      }
    }

    if (!isValidMagic) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "File content does not match declared type. Please upload a valid file.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify MIME type matches expected type
    if (fileMimeType !== allowedType.mimeType) {
      console.warn(
        `MIME type mismatch for ${fileName}: declared ${fileMimeType}, expected ${allowedType.mimeType}`
      );
      // Don't fail on MIME type mismatch if magic bytes are valid,
      // but log it for security monitoring
    }

    return new Response(
      JSON.stringify({ success: true, message: "File validation passed" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error in validate-file-upload function:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: "An error occurred during file validation. Please try again or contact support.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
