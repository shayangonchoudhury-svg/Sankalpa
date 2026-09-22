// Supabase Edge Function: upload-avatar
// Validates Firebase Authentication ID tokens and securely saves avatar photos into Supabase Storage.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { createRemoteJWKSet, jwtVerify, decodeJwt } from "https://esm.sh/jose@5.2.3";

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
      throw new Error("Missing FIREBASE_PROJECT_ID environment variable in Edge Function");
    }
    const firebaseIssuer = `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`;

    // 5. Verify Firebase ID token with jose
    let uid: string;
    try {
      const decodedPayload = decodeJwt(firebaseToken);

      console.log("Firebase JWT diagnostic", {
        configuredProjectId: FIREBASE_PROJECT_ID,
        configuredProjectIdLength: FIREBASE_PROJECT_ID.length,
        expectedIssuer: firebaseIssuer,
        tokenIssuer: decodedPayload.iss,
        tokenAudience: decodedPayload.aud,
      });

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
      console.error("Firebase token verification error:", verifyErr.message);
      return new Response(
        JSON.stringify({ error: verifyErr.message || "Invalid or expired Firebase token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Parse uploaded file from multipart/form-data
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File || file instanceof Blob)) {
      return new Response(
        JSON.stringify({ error: "Missing file field in form data" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate 5MB file size limit
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({ error: "File size exceeds 5MB limit" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate allowed MIME types (JPEG, PNG, WebP)
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
    const fileType = (file as File).type || "image/jpeg";
    if (!allowedMimeTypes.includes(fileType)) {
      return new Response(
        JSON.stringify({ error: "Invalid file type. Only JPEG, PNG, and WebP images are allowed" }),
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

    // 8. Upload avatar to Supabase Storage avatars bucket under ${uid}/avatar_${timestamp}.ext
    const timestamp = Date.now();
    const ext = fileType === "image/png" ? "png" : fileType === "image/webp" ? "webp" : "jpg";
    const filePath = `${uid}/avatar_${timestamp}.${ext}`;
    const arrayBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, arrayBuffer, {
        contentType: fileType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: uploadError.message || "Failed to upload avatar to storage" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Generate public URL for avatar
    const { data: urlData } = supabase.storage
      .from("avatars")
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
    console.error("Unexpected error in upload-avatar function:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
