// verify-pin: server-side PIN verification with rate limiting.
// Diary PIN hashes never leave the database; the frontend only gets ok/fail.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const PIN_PATTERN = /^\d{4,6}$/;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Identify the caller from their JWT; PINs are always self-scoped.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let pin: string, mode: string;
  try {
    const body = await req.json();
    pin = String(body?.pin ?? "");
    mode = body?.mode === "set" ? "set" : "verify";
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (!PIN_PATTERN.test(pin)) return json({ error: "pin_format" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: row, error: readError } = await admin
    .from("diary_pins")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("user_id", user.id)
    .maybeSingle();
  if (readError) return json({ error: "server_error" }, 500);

  if (mode === "set") {
    if (row) {
      // Changing an existing PIN requires the current PIN.
      const { data: ok } = await admin.rpc("check_pin", { p_user: user.id, p_pin: pin });
      if (!ok) return json({ error: "pin_incorrect" }, 403);
      const { data: newHash } = await admin.rpc("hash_pin", { p_pin: pin });
      const { error } = await admin
        .from("diary_pins")
        .update({ pin_hash: newHash, failed_attempts: 0, locked_until: null })
        .eq("user_id", user.id);
      if (error) return json({ error: "server_error" }, 500);
      return json({ ok: true });
    }
    const { data: newHash } = await admin.rpc("hash_pin", { p_pin: pin });
    const { error } = await admin
      .from("diary_pins")
      .insert({ user_id: user.id, pin_hash: newHash });
    if (error) return json({ error: "server_error" }, 500);
    return json({ ok: true });
  }

  // verify mode
  if (!row) return json({ error: "no_pin" }, 404);
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    return json({ error: "locked", locked_until: row.locked_until }, 429);
  }

  const { data: ok } = await admin.rpc("check_pin", { p_user: user.id, p_pin: pin });
  if (ok) {
    await admin
      .from("diary_pins")
      .update({ failed_attempts: 0, locked_until: null })
      .eq("user_id", user.id);
    return json({ ok: true });
  }

  const attempts = (row.failed_attempts ?? 0) + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000).toISOString()
    : null;
  await admin
    .from("diary_pins")
    .update({ failed_attempts: attempts >= MAX_ATTEMPTS ? 0 : attempts, locked_until: lockedUntil })
    .eq("user_id", user.id);
  return json({ ok: false, attempts_left: Math.max(0, MAX_ATTEMPTS - attempts) }, 401);
});
