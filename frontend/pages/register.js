import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Register() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", display_name: "" });
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { display_name: form.display_name } },
    });
    if (error) return setError(error.message);
    // لو تفعيل البريد شغّال بمشروعك، Supabase يرسل رابط تأكيد قبل ما تصير الجلسة فعّالة
    if (!data.session) return setSent(true);
    router.push("/");
  };

  if (sent) {
    return (
      <div className="container" style={{ maxWidth: 380, margin: "60px auto" }}>
        <h1>تحقق من بريدك</h1>
        <p>أرسلنا رابط تأكيد إلى بريدك الإلكتروني. افتحه لتفعيل الحساب ثم سجّل الدخول.</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 380, margin: "60px auto" }}>
      <h1>إنشاء حساب</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input className="search-bar" style={{ width: "100%", margin: 0 }} placeholder="الاسم"
          value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} />
        <input className="search-bar" style={{ width: "100%", margin: 0 }} type="email" placeholder="البريد الإلكتروني"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="search-bar" style={{ width: "100%", margin: 0 }} type="password" placeholder="كلمة المرور"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
        <button type="submit">إنشاء الحساب</button>
      </form>
      {error && <p style={{ color: "var(--accent)" }}>{error}</p>}
      <p style={{ marginTop: 16, color: "var(--text-dim)" }}>
        عندك حساب؟ <a href="/login" style={{ color: "var(--accent)" }}>سجّل دخولك</a>
      </p>
    </div>
  );
}
