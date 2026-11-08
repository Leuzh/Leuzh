import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return Response.json({ error: "method not allowed" }, { status: 405, headers: cors });

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !key || !authorization) return Response.json({ error: "authentication required" }, { status: 401, headers: cors });

  try {
    const db = createClient(url, key, { global: { headers: { Authorization: authorization } } });
    const { data: { user }, error: authError } = await db.auth.getUser();
    if (authError || !user) return Response.json({ error: "invalid session" }, { status: 401, headers: cors });

    const body = await request.json();
    const seconds = Number(body.survivalSeconds);
    const kills = Number(body.kills);
    const level = Number(body.level);
    const runId = String(body.clientRunId || "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(runId)
      || !Number.isInteger(seconds) || !Number.isInteger(kills) || !Number.isInteger(level)) {
      return Response.json({ error: "invalid run data" }, { status: 400, headers: cors });
    }

    const { data, error } = await db.rpc("submit_run", {
      p_client_run_id: runId,
      p_survival_seconds: seconds,
      p_kills: kills,
      p_level: level,
    });
    if (error) return Response.json({ error: error.message }, { status: 400, headers: cors });
    return Response.json({ run: data }, { status: 201, headers: cors });
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400, headers: cors });
  }
});
