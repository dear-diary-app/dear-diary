// verify-pin: server-side PIN verification with rate limiting.
// Diary PIN hashes never leave the database; the frontend only gets ok/fail.
import { createClient } from "npm:@supabase/supabase-js@2";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const PIN_PATTERN = /^\d{4}$/;

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

  // Identify the caller from their JWT.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: "unauthorized" }, 401);

  let pin: string, mode: string, person: string | null, current: string;
  try {
    const body = await req.json();
    pin = String(body?.pin ?? "");
    mode = body?.mode === "set" ? "set" : body?.mode === "status" ? "status" : "verify";
    person = typeof body?.person === "string" ? body.person : null;
    current = String(body?.current ?? "");
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (mode !== "status" && !PIN_PATTERN.test(pin)) return json({ error: "pin_format" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);

  // Resolve which account's PIN is being checked. Default: the caller's own.
  let targetId = user.id;
  if (person) {
    const { data: prof, error: profError } = await admin
      .from("profiles")
      .select("id")
      .eq("username", person)
      .maybeSingle();
    if (profError || !prof) return json({ error: "unknown_person" }, 400);
    targetId = prof.id;
  }

  // A PIN can only be created or changed by its owner.
  if (mode === "set" && targetId !== user.id) {
    return json({ error: "not_owner" }, 403);
  }

  // status: does the target diary have a PIN? Never counts as an attempt.
  if (mode === "status") {
    const { data: srow, error: serr } = await admin
      .from("diary_pins")
      .select("locked_until")
      .eq("user_id", targetId)
      .maybeSingle();
    if (serr) return json({ error: "server_error" }, 500);
    const locked = !!(srow && srow.locked_until && new Date(srow.locked_until) > new Date());
    return json({ ok: true, hasPin: !!srow, locked });
  }

  const { data: row, error: readError } = await admin
    .from("diary_pins")
    .select("pin_hash, failed_attempts, locked_until")
    .eq("user_id", targetId)
    .maybeSingle();
  if (readError) return json({ error: "server_error" }, 500);

  if (mode === "set" && !row) {
    const { data: newHash, error: hashError } = await admin.rpc("hash_pin", { p_pin: pin });
    if (hashError || !newHash) return json({ error: "server_error" }, 500);
    const { error } = await admin.from("diary_pins").insert({ user_id: user.id, pin_hash: newHash });
    if (error) return json({ error: "server_error" }, 500);
    return json({ ok: true });
  }
  // Serialize attempts and changes on the PIN row. Both obey the same lockout.
  const { data: result, error: attemptError } = await admin.rpc("pin_attempt", {
    p_user: targetId,
    p_pin: mode === "set" ? current : pin,
    p_new_pin: mode === "set" ? pin : null,
  });
  if (attemptError || !result) return json({ error: "server_error" }, 500);
  const status = result.ok ? 200 : result.error === "locked" ? 429 : result.error === "no_pin" ? 404 : 400;
  return json(result, status);
});
