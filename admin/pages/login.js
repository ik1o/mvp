import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AdminLogin() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const { data, error } = await supabase.auth.signInWithPassword(form);
    if (error) return setError("بيانات الدخول غير صحيحة");

    const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", data.user.id).single();
    if (!profile?.is_admin) {
      await supabase.auth.signOut();
      return setError("هذا الحساب ليس مشرفًا");
    }
    window.location.href = "/";
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>دخول المشرف</h1>
      <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
        <input type="email" placeholder="البريد الإلكتروني" value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input type="password" placeholder="كلمة المرور" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit">دخول</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
