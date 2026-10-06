import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function GlossaryPage() {
  const [seriesList, setSeriesList] = useState([]);
  const [seriesId, setSeriesId] = useState("");
  const [terms, setTerms] = useState([]);
  const [form, setForm] = useState({ original_term: "", arabic_term: "", term_type: "name" });

  useEffect(() => {
    supabase.from("series").select("id, title_ar").then(({ data }) => setSeriesList(data || []));
  }, []);

  const loadTerms = (id) => {
    if (!id) return setTerms([]);
    supabase.from("glossary_terms").select("*").eq("series_id", id).order("original_term")
      .then(({ data }) => setTerms(data || []));
  };

  useEffect(() => loadTerms(seriesId), [seriesId]);

  const submit = async (e) => {
    e.preventDefault();
    if (!seriesId) return alert("اختر العمل أولًا");
    await supabase.from("glossary_terms").upsert(
      { series_id: Number(seriesId), ...form },
      { onConflict: "series_id,original_term" }
    );
    setForm({ original_term: "", arabic_term: "", term_type: "name" });
    loadTerms(seriesId);
  };

  const remove = async (id) => {
    await supabase.from("glossary_terms").delete().eq("id", id);
    loadTerms(seriesId);
  };

  return (
    <div style={{ maxWidth: 650, margin: "40px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>قاموس الترجمة الخاص بكل عمل</h1>
      <label>اختر العمل
        <select value={seriesId} onChange={(e) => setSeriesId(e.target.value)} style={{ display: "block", width: "100%", marginBottom: 20 }}>
          <option value="">-- اختر --</option>
          {seriesList.map((s) => <option key={s.id} value={s.id}>{s.title_ar}</option>)}
        </select>
      </label>

      {seriesId && (
        <>
          <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <input placeholder="الأصلي (مثال: Nathan)" value={form.original_term}
              onChange={(e) => setForm({ ...form, original_term: e.target.value })} required />
            <input placeholder="العربي (مثال: ناثان)" value={form.arabic_term}
              onChange={(e) => setForm({ ...form, arabic_term: e.target.value })} required />
            <select value={form.term_type} onChange={(e) => setForm({ ...form, term_type: e.target.value })}>
              <option value="name">اسم</option><option value="term">مصطلح</option><option value="place">مكان</option>
            </select>
            <button type="submit">حفظ</button>
          </form>

          <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
            <thead><tr style={{ borderBottom: "1px solid #ccc" }}>
              <th align="right">الأصلي</th><th align="right">العربي</th><th align="right">النوع</th><th></th>
            </tr></thead>
            <tbody>
              {terms.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td>{t.original_term}</td><td>{t.arabic_term}</td><td>{t.term_type}</td>
                  <td><button onClick={() => remove(t.id)} style={{ color: "crimson" }}>حذف</button></td>
                </tr>
              ))}
              {terms.length === 0 && <tr><td colSpan="4" style={{ color: "#999" }}>لا توجد مصطلحات بعد لهذا العمل.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
