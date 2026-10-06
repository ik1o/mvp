// GET-style: تستدعى من لوحة التحكم عبر supabase.functions.invoke("discover-search", { body: { title } })
// تتطلب أن يكون المستخدم المستدعي مشرفًا (نتحقق من التوكن المُرسل تلقائيًا من supabase-js).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildConnector } from "../_shared/sourceConnector.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  // نتحقق من هوية المستدعي بتوكنه الخاص (وليس service role) عشان نتأكد إنه مشرف فعلي
  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });

  const { title } = await req.json();
  if (!title) return new Response(JSON.stringify({ error: "missing_title" }), { status: 400 });

  const { data: sources } = await admin
    .from("sources").select("*")
    .eq("is_active", true).in("license_status", ["owned", "licensed", "permitted"]);

  if (!sources || sources.length === 0) {
    return new Response(JSON.stringify({
      results: [],
      message: "لا يوجد مصادر مرخّصة مفعّلة. أضف مصدرًا بحالة owned/licensed/permitted من جدول sources أولًا.",
    }), { status: 200 });
  }

  const results: any[] = [];
  for (const source of sources) {
    try {
      const connector = buildConnector(source);
      const matches = await connector.search(title);
      for (const m of matches || []) results.push({ ...m, source_id: source.id, source_name: source.name });
    } catch (err) {
      results.push({ source_id: source.id, source_name: source.name, error: String((err as Error).message || err) });
    }
  }

  return new Response(JSON.stringify({ results }), { status: 200, headers: { "Content-Type": "application/json" } });
});
