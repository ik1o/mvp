// تُستدعى بجدولة pg_cron كل 15 دقيقة (شوف migrations/0001_init.sql).
// تفحص فقط المصادر المرخّصة (owned/licensed/permitted)، وتجمّع أي فصل جديد.
// إدخال فصل جديد يفعّل تلقائيًا process-chapter عبر الـ Database Webhook.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buildConnector } from "../_shared/sourceConnector.ts";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

Deno.serve(async (_req) => {
  const { data: setting } = await sb.from("system_settings").select("value").eq("key", "auto_update_enabled").single();
  if (setting?.value !== "true") {
    return new Response(JSON.stringify({ skipped: true, reason: "auto_update_disabled" }), { status: 200 });
  }

  const { data: links } = await sb
    .from("series_sources")
    .select("series_id, external_ref, source_id, series(title_ar), sources(*)")
    .eq("sources.is_active", true)
    .in("sources.license_status", ["owned", "licensed", "permitted"]);

  const report = { checked: links?.length || 0, new_chapters: 0, errors: [] as any[] };

  for (const link of links || []) {
    const source = (link as any).sources;
    if (!source) continue;
    try {
      const connector = buildConnector(source);
      const remoteChapters = await connector.listChapters(link.external_ref);

      for (const ch of remoteChapters || []) {
        const { data: existing } = await sb
          .from("chapters").select("id")
          .eq("series_id", link.series_id).eq("chapter_number", ch.chapter_number)
          .maybeSingle();
        if (existing) continue;

        const { data: newChapter } = await sb.from("chapters").insert({
          series_id: link.series_id, source_id: link.source_id,
          chapter_number: ch.chapter_number, title_ar: ch.title || null,
          status: "pending", released_at: ch.released_at || null,
        }).select("id").single();

        const pageUrls: string[] = await connector.getChapterPages(link.external_ref, ch.chapter_number);
        await sb.from("pages").insert(
          pageUrls.map((url, i) => ({ chapter_id: newChapter!.id, page_number: i + 1, original_image_url: url }))
        );

        report.new_chapters++;
        // ما نستدعي process-chapter يدويًا هنا — الـ Database Webhook على INSERT
        // بجدول chapters يتكفّل باستدعائها تلقائيًا.
      }
    } catch (err) {
      report.errors.push({ series_id: link.series_id, error: String((err as Error).message || err) });
    }
  }

  await sb.from("system_settings").upsert({ key: "last_auto_update_run", value: new Date().toISOString() });

  return new Response(JSON.stringify(report), { status: 200, headers: { "Content-Type": "application/json" } });
});
