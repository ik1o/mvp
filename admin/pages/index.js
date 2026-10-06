import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminHome() {
  const [form, setForm] = useState({ title_ar: "", title_original: "", slug: "", description_ar: "" });
  const [chapters, setChapters] = useState([]);

  const refresh = () => {
    supabase.from("chapters").select("id, chapter_number, status, series:series_id(title_ar)")
      .neq("status", "ready").order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => setChapters(data || []));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const submitSeries = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("series").insert(form);
    if (error) return alert(error.message);
    setForm({ title_ar: "", title_original: "", slug: "", description_ar: "" });
    alert("تمت الإضافة");
  };

  return (
    <div style={{ maxWidth: 700, margin: "40px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>لوحة التحكم</h1>
        <button onClick={() => supabase.auth.signOut().then(() => (window.location.href = "/login"))}>تسجيل الخروج</button>
      </div>

      <nav style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <a href="/upload">رفع فصل</a>
        <a href="/discover">بحث وتجميع</a>
        <a href="/glossary">القاموس</a>
        <a href="/settings">الإعدادات</a>
        <a href="/errors">الأخطاء</a>
      </nav>

      <h2>إضافة مانهوا</h2>
      <form onSubmit={submitSeries} style={{ display: "grid", gap: 10 }}>
        <input placeholder="الاسم بالعربي" value={form.title_ar}
          onChange={(e) => setForm({ ...form, title_ar: e.target.value })} required />
        <input placeholder="الاسم الأصلي" value={form.title_original}
          onChange={(e) => setForm({ ...form, title_original: e.target.value })} />
        <input placeholder="slug (مثال: no-bad-heroes)" value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
        <textarea placeholder="الوصف" value={form.description_ar}
          onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
        <button type="submit">إضافة</button>
      </form>

      <h2 style={{ marginTop: 40 }}>حالة معالجة الفصول</h2>
      <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
        <thead><tr style={{ borderBottom: "1px solid #ccc" }}>
          <th align="right">العمل</th><th align="right">الفصل</th><th align="right">الحالة</th>
        </tr></thead>
        <tbody>
          {chapters.map((j) => (
            <tr key={j.id} style={{ borderBottom: "1px solid #eee" }}>
              <td>{j.series?.title_ar}</td><td>{j.chapter_number}</td><td>{j.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
