// تستدعى من لوحة التحكم: supabase.functions.invoke("discover-import", { body: {...} })
// تنشئ العمل وتجمّع كل فصوله من المصدر المختار. إدخال كل فصل يفعّل process-chapter تلقائيًا
// عبر الـ Database Webhook على INSERT بجدول chapters (نفس فكرة check-new-chapters).

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildConnector } from "../_shared/sourceConnector.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function slugify(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9\u0600-\u06FF]+/g, "-").replace(/(^-|-$)/g, "");
}

Deno.serve(async (req) => {
  const authHeader = req.headers.get("Authorization") || "";
  const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await callerClient.auth.getUser();
  if (!userData?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: profile } = await admin.from("profiles").select("is_admin").eq("id", userData.user.id).single();
  if (!profile?.is_admin) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });

  const { source_id, external_ref, title_ar, title_original, cover_url } = await req.json();
  if (!source_id || !external_ref || !title_ar) {
    return new Response(JSON.stringify({ error: "missing_fields" }), { status: 400 });
  }

  const { data: source } = await admin
    .from("sources").select("*").eq("id", source_id)
    .in("license_status", ["owned", "licensed", "permitted"]).maybeSingle();
  if (!source) return new Response(JSON.stringify({ error: "source_not_licensed" }), { status: 403 });

  const connector = buildConnector(source);
  const slug = slugify(title_original || title_ar);

  const { data: series } = await admin
    .from("series")
    .upsert({ title_ar, title_original, slug, cover_url }, { onConflict: "slug" })
    .select("id").single();

  await admin.from("series_sources").upsert(
    { series_id: series!.id, source_id, external_ref },
    { onConflict: "series_id,source_id" }
  );

  const chapters = await connector.listChapters(external_ref);
  let queued = 0;

  for (const ch of chapters || []) {
    const { data: existing } = await admin
      .from("chapters").select("id")
      .eq("series_id", series!.id).eq("chapter_number", ch.chapter_number).maybeSingle();
    if (existing) continue;

    const { data: newChapter } = await admin.from("chapters").insert({
      series_id: series!.id, source_id, chapter_number: ch.chapter_number,
      title_ar: ch.title || null, status: "pending", released_at: ch.released_at || null,
    }).select("id").single();

    const pageUrls: string[] = await connector.getChapterPages(external_ref, ch.chapter_number);
    await admin.from("pages").insert(
      pageUrls.map((url, i) => ({ chapter_id: newChapter!.id, page_number: i + 1, original_image_url: url }))
    );
    queued++;
  }

  return new Response(JSON.stringify({ ok: true, series_id: series!.id, chapters_queued: queued }), {
    status: 200, headers: { "Content-Type": "application/json" },
  });
});
