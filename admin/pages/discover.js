import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function DiscoverPage() {
  const [title, setTitle] = useState("");
  const [results, setResults] = useState([]);
  const [message, setMessage] = useState("");
  const [importStatus, setImportStatus] = useState("");

  const search = async (e) => {
    e.preventDefault();
    setMessage("جاري البحث...");
    setResults([]);
    const { data, error } = await supabase.functions.invoke("discover-search", { body: { title } });
    if (error) { setMessage(`خطأ: ${error.message}`); return; }
    setResults(data.results || []);
    setMessage(data.message || (data.results?.length ? "" : "لا نتائج"));
  };

  const importSeries = async (r) => {
    setImportStatus(`جاري تجميع فصول "${r.title}"...`);
    const { data, error } = await supabase.functions.invoke("discover-import", {
      body: {
        source_id: r.source_id, external_ref: r.external_ref,
        title_ar: r.title_ar || r.title, title_original: r.title, cover_url: r.cover_url,
      },
    });
    if (error) { setImportStatus(`خطأ: ${error.message}`); return; }
    setImportStatus(`تم إنشاء العمل وبدأت ترجمة ${data.chapters_queued} فصل تلقائيًا بالخلفية.`);
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>بحث وتجميع تلقائي</h1>
      <p style={{ color: "#777" }}>
        يبحث فقط داخل المصادر المسجّلة عندك بحالة ترخيص owned / licensed / permitted.
        أضف مصادرك من جدول sources قبل الاستخدام.
      </p>

      <form onSubmit={search} style={{ display: "flex", gap: 8 }}>
        <input style={{ flex: 1 }} placeholder="اسم المانهوا أو المانجا" value={title}
          onChange={(e) => setTitle(e.target.value)} required />
        <button type="submit">بحث</button>
      </form>

      {message && <p style={{ marginTop: 12 }}>{message}</p>}
      {importStatus && <p style={{ marginTop: 12, fontWeight: "bold" }}>{importStatus}</p>}

      <ul style={{ listStyle: "none", padding: 0, marginTop: 20 }}>
        {results.map((r, i) => (
          <li key={i} style={{ border: "1px solid #eee", borderRadius: 8, padding: 12, marginBottom: 10 }}>
            {r.error ? (
              <span style={{ color: "crimson" }}>{r.source_name}: {r.error}</span>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{r.title}</strong>
                  <div style={{ fontSize: 13, color: "#777" }}>المصدر: {r.source_name}</div>
                </div>
                <button onClick={() => importSeries(r)}>تجميع الفصول وترجمتها</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
