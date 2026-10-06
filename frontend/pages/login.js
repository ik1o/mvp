import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithPassword(form);
    if (error) return setError("بيانات الدخول غير صحيحة");
    router.push("/");
  };

  return (
    <div className="container" style={{ maxWidth: 380, margin: "60px auto" }}>
      <h1>تسجيل الدخول</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
        <input className="search-bar" style={{ width: "100%", margin: 0 }} type="email" placeholder="البريد الإلكتروني"
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input className="search-bar" style={{ width: "100%", margin: 0 }} type="password" placeholder="كلمة المرور"
          value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit">دخول</button>
      </form>
      {error && <p style={{ color: "var(--accent)" }}>{error}</p>}
      <p style={{ marginTop: 16, color: "var(--text-dim)" }}>
        ما عندك حساب؟ <a href="/register" style={{ color: "var(--accent)" }}>أنشئ واحد</a>
      </p>
    </div>
  );
}
