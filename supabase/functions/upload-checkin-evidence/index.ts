// Supabase Edge Function: upload-checkin-evidence
// Validates Firebase Authentication ID tokens and securely saves commitment check-in evidence into Supabase Storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { createRemoteJWKSet, jwtVerify } from "https://esm.sh/jose@5.2.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Remote JWKS for verifying Google Firebase ID tokens
const firebaseKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

serve(async (req: Request) => {
  // 1. Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // 2. Enforce POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // 3. Extract Firebase ID token from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing Firebase authentication token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const firebaseToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    // 4. Resolve Firebase Project ID & Issuer
    const FIREBASE_PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID");
    if (!FIREBASE_PROJECT_ID) {
      throw new Error("Missing FIREBASE_PROJECT_ID environment variable");
    }
    const firebaseIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

    // 5. Verify Firebase ID token with jose
    let uid: string;
    try {
      const { payload } = await jwtVerify(
        firebaseToken,
        firebaseKeys,
        {
          issuer: firebaseIssuer,
          audience: FIREBASE_PROJECT_ID,
        }
      );

      if (!payload.sub) {
        throw new Error("Token payload missing user UID (sub claim)");
      }
      uid = payload.sub;
    } catch (verifyErr: any) {
      return new Response(
        JSON.stringify({ error: verifyErr.message || "Invalid or expired Firebase token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Parse uploaded multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");
    const commitmentId = formData.get("commitmentId");

    if (!commitmentId || typeof commitmentId !== "string" || !commitmentId.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid commitmentId in form data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!file || !(file instanceof File || file instanceof Blob)) {
      return new Response(
        JSON.stringify({ error: "Missing file field in form data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fileType = (file as File).type || "";
    const isImage = ["image/jpeg", "image/png", "image/webp"].includes(fileType);
    const isVideo = fileType === "video/mp4";

    if (!isImage && !isVideo) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Only JPEG, PNG, WebP images and MP4 videos are allowed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Size limit: 5MB for images, 20MB for videos
    const maxSizeBytes = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return new Response(
        JSON.stringify({
          error: isVideo
            ? "Video size exceeds 20MB limit"
            : "Image size exceeds 5MB limit",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 7. Initialize Supabase Admin client using SUPABASE_SECRET_KEYS["default"]
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const secretKeysRaw = Deno.env.get("SUPABASE_SECRET_KEYS");

    if (!supabaseUrl || !secretKeysRaw) {
      console.error("Missing SUPABASE_URL or SUPABASE_SECRET_KEYS in Edge Function environment");
      return new Response(
        JSON.stringify({ error: "Storage configuration error in Edge Function" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const secretKeys = JSON.parse(secretKeysRaw);
    const secretKey = secretKeys["default"];

    if (!secretKey) {
      console.error("Missing default key in SUPABASE_SECRET_KEYS");
      return new Response(
        JSON.stringify({ error: "Storage key configuration error in Edge Function" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, secretKey);

    // 8. Upload to checkin-evidence bucket using path convention:
    // {uid}/{commitmentId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const originalName = (file as File).name || (isVideo ? "video.mp4" : "photo.jpg");
    const sanitizedName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = `${uid}/${commitmentId.trim()}/${timestamp}_${sanitizedName}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("checkin-evidence")
      .upload(filePath, arrayBuffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Check-in evidence storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message || "Failed to upload evidence to storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Generate public URL for checkin-evidence
    const { data: urlData } = supabase.storage
      .from("checkin-evidence")
      .getPublicUrl(filePath);

    const publicUrl = urlData.publicUrl;

    return new Response(
      JSON.stringify({
        success: true,
        uid,
        path: filePath,
        publicUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Unexpected error in upload-checkin-evidence function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
