import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function UploadChapter() {
  const [form, setForm] = useState({ series_id: "", chapter_number: "", title_ar: "" });
  const [urlsText, setUrlsText] = useState("");
  const [status, setStatus] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setStatus("جاري الرفع...");

    const page_urls = urlsText.split("\n").map((u) => u.trim()).filter(Boolean);

    const { data: chapter, error } = await supabase.from("chapters").insert({
      series_id: Number(form.series_id),
      chapter_number: Number(form.chapter_number),
      title_ar: form.title_ar || null,
      status: "pending",
    }).select("id").single();

    if (error) { setStatus(`خطأ: ${error.message}`); return; }

    const { error: pagesError } = await supabase.from("pages").insert(
      page_urls.map((url, i) => ({ chapter_id: chapter.id, page_number: i + 1, original_image_url: url }))
    );
    if (pagesError) { setStatus(`خطأ بالصفحات: ${pagesError.message}`); return; }

    // إدخال الفصل يفعّل تلقائيًا Database Webhook اللي يستدعي دالة process-chapter بالخلفية
    setStatus(`تم رفع ${page_urls.length} صفحة، المعالجة بدأت تلقائيًا بالخلفية (Chapter ID: ${chapter.id}).`);
    setUrlsText("");
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>رفع فصل جديد</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <label>معرّف العمل (series_id)
          <input value={form.series_id} onChange={(e) => setForm({ ...form, series_id: e.target.value })} required />
        </label>
        <label>رقم الفصل
          <input value={form.chapter_number} onChange={(e) => setForm({ ...form, chapter_number: e.target.value })} required />
        </label>
        <label>عنوان الفصل (اختياري)
          <input value={form.title_ar} onChange={(e) => setForm({ ...form, title_ar: e.target.value })} />
        </label>
        <label>روابط صور الصفحات (رابط واحد في كل سطر، بالترتيب)
          <textarea rows={10} value={urlsText} onChange={(e) => setUrlsText(e.target.value)}
            placeholder={"https://.../page1.jpg\nhttps://.../page2.jpg"} required />
        </label>
        <button type="submit">رفع وبدء المعالجة</button>
      </form>
      {status && <p style={{ marginTop: 16 }}>{status}</p>}
    </div>
  );
}
