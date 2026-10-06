import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function ErrorsPage() {
  const [failedChapters, setFailedChapters] = useState([]);
  const [jobErrors, setJobErrors] = useState([]);
  const [retrying, setRetrying] = useState(null);

  const load = () => {
    supabase.from("chapters").select("id, chapter_number, series:series_id(title_ar)")
      .eq("status", "failed").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setFailedChapters(data || []));

    supabase.from("processing_jobs")
      .select("id, chapter_id, stage, error_message, finished_at, chapters:chapter_id(chapter_number, series:series_id(title_ar))")
      .eq("status", "error").order("finished_at", { ascending: false }).limit(100)
      .then(({ data }) => setJobErrors(data || []));
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 10000);
    return () => clearInterval(t);
  }, []);

  const retry = async (chapterId) => {
    setRetrying(chapterId);
    await supabase.from("chapters").update({ status: "pending" }).eq("id", chapterId);
    await supabase.functions.invoke("process-chapter", { body: { chapter_id: chapterId } });
    setRetrying(null);
    load();
  };

  return (
    <div style={{ maxWidth: 800, margin: "40px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>الأخطاء</h1>

      <h2>فصول فشلت معالجتها ({failedChapters.length})</h2>
      {failedChapters.length === 0 && <p style={{ color: "#777" }}>لا توجد فصول فاشلة حاليًا.</p>}
      <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse", marginBottom: 30 }}>
        <thead><tr style={{ borderBottom: "1px solid #ccc" }}>
          <th align="right">العمل</th><th align="right">الفصل</th><th></th>
        </tr></thead>
        <tbody>
          {failedChapters.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{c.series?.title_ar}</td><td>{c.chapter_number}</td>
              <td>
                <button onClick={() => retry(c.id)} disabled={retrying === c.id}>
                  {retrying === c.id ? "جاري إعادة المحاولة..." : "إعادة المحاولة"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>سجل تفاصيل الأخطاء ({jobErrors.length})</h2>
      {jobErrors.length === 0 && <p style={{ color: "#777" }}>لا يوجد سجل أخطاء.</p>}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {jobErrors.map((e) => (
          <li key={e.id} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 8 }}>
            <strong>{e.chapters?.series?.title_ar}</strong> — الفصل {e.chapters?.chapter_number} ({e.stage})
            <div style={{ color: "crimson", fontSize: 13, marginTop: 4 }}>{e.error_message}</div>
            <div style={{ color: "#999", fontSize: 12, marginTop: 2 }}>
              {e.finished_at && new Date(e.finished_at).toLocaleString("ar")}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
