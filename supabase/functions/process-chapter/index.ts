// يعالج فصل كامل بالخلفية: OCR ثم ترجمة لكل صفحة.
// يُستدعى تلقائيًا عبر Database Webhook عند INSERT على جدول chapters،
// أو يدويًا من لوحة التحكم (retry). يرد فورًا 202 ويكمل الشغل بالخلفية
// عبر EdgeRuntime.waitUntil حتى ما يضطر المشرف ينتظر.

import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OCR_PROVIDER = Deno.env.get("OCR_PROVIDER") || "mock";
const TRANSLATION_PROVIDER = Deno.env.get("TRANSLATION_PROVIDER") || "mock";
const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY") || "";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";

function admin() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
}

async function extractText(imageUrl: string) {
  if (OCR_PROVIDER === "google_vision") {
    const res = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: imageUrl } },
            features: [{ type: "TEXT_DETECTION" }],
            imageContext: { languageHints: ["en", "ja", "ko", "zh"] },
          }],
        }),
      }
    );
    const data = await res.json();
    const annotations = data?.responses?.[0]?.textAnnotations;
    if (!annotations || annotations.length <= 1) return [];
    return annotations.slice(1).map((a: any) => {
      const xs = a.boundingPoly.vertices.map((v: any) => v.x || 0);
      const ys = a.boundingPoly.vertices.map((v: any) => v.y || 0);
      return {
        text: a.description,
        x: Math.min(...xs), y: Math.min(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        height: Math.max(...ys) - Math.min(...ys),
      };
    });
  }
  // mock
  return [{ text: "Sample dialogue", x: 100, y: 200, width: 150, height: 40 }];
}

async function translateBlocks(blocks: any[], glossary: Record<string, string>) {
  if (blocks.length === 0) return [];

  if (TRANSLATION_PROVIDER === "claude") {
    const systemPrompt = [
      "أنت مترجم متخصص في ترجمة فقاعات الحوار في المانجا/المانهوا من الإنجليزية إلى العربية.",
      "التزم بالقاموس التالي لأسماء الشخصيات والمصطلحات الثابتة (لا تغيّرها):",
      JSON.stringify(glossary, null, 2),
      "أعد فقط مصفوفة JSON بنفس ترتيب المدخلات، كل عنصر: { \"id\": <رقم>, \"translated\": \"<النص>\" }",
      "بدون أي نص إضافي أو شروحات أو Markdown.",
    ].join("\n");

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: "user", content: JSON.stringify(blocks.map((b, i) => ({ id: i, text: b.text }))) }],
      }),
    });
    const data = await res.json();
    const raw = data?.content?.find((c: any) => c.type === "text")?.text || "[]";
    try {
      const translations = JSON.parse(raw.replace(/```json|```/g, "").trim());
      return blocks.map((b, i) => ({
        ...b,
        translated: translations.find((t: any) => t.id === i)?.translated || b.text,
      }));
    } catch {
      return blocks.map((b) => ({ ...b, translated: b.text }));
    }
  }

  // mock: يطبّق القاموس بس بدل نموذج حقيقي
  return blocks.map((b) => {
    let text = b.text;
    for (const [original, arabic] of Object.entries(glossary)) {
      text = text.replaceAll(original, arabic);
    }
    return { ...b, translated: `[AR] ${text}` };
  });
}

async function updateStage(chapterId: number, status: string) {
  await admin().from("chapters").update({ status }).eq("id", chapterId);
}

async function processChapter(chapterId: number) {
  const sb = admin();
  try {
    await updateStage(chapterId, "ocr");

    const { data: pages } = await sb
      .from("pages").select("id, page_number, original_image_url")
      .eq("chapter_id", chapterId).order("page_number");

    const { data: chapterRow } = await sb.from("chapters").select("series_id").eq("id", chapterId).single();
    const { data: glossaryRows } = await sb
      .from("glossary_terms").select("original_term, arabic_term")
      .eq("series_id", chapterRow!.series_id);
    const glossary = Object.fromEntries((glossaryRows || []).map((r: any) => [r.original_term, r.arabic_term]));

    for (const page of pages || []) {
      const blocks = await extractText(page.original_image_url);
      await sb.from("pages").update({ ocr_text: blocks }).eq("id", page.id);

      await updateStage(chapterId, "translating");
      const translated = await translateBlocks(blocks, glossary);
      await sb.from("pages").update({ translated_text: translated }).eq("id", page.id);
    }

    await updateStage(chapterId, "ready");
  } catch (err) {
    await updateStage(chapterId, "failed");
    await sb.from("processing_jobs").insert({
      chapter_id: chapterId, stage: "unknown", status: "error",
      error_message: String((err as Error).message || err),
      started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
    });
  }
}

Deno.serve(async (req) => {
  const body = await req.json().catch(() => ({}));
  // يدعم شكل Database Webhook: { record: { id, ... } }، وشكل استدعاء يدوي: { chapter_id }
  const chapterId = body?.record?.id ?? body?.chapter_id;
  if (!chapterId) {
    return new Response(JSON.stringify({ error: "missing_chapter_id" }), { status: 400 });
  }

  // @ts-ignore — EdgeRuntime متاح فقط داخل بيئة Supabase Edge Functions
  EdgeRuntime.waitUntil(processChapter(chapterId));

  return new Response(JSON.stringify({ ok: true, queued: chapterId }), {
    status: 202,
    headers: { "Content-Type": "application/json" },
  });
});
