import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function SettingsPage() {
  const [enabled, setEnabled] = useState(false);
  const [lastRun, setLastRun] = useState(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const load = () => {
    supabase.from("system_settings").select("key, value")
      .in("key", ["auto_update_enabled", "last_auto_update_run"])
      .then(({ data }) => {
        const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]));
        setEnabled(map.auto_update_enabled === "true");
        setLastRun(map.last_auto_update_run || null);
      });
  };

  useEffect(load, []);

  const toggle = async () => {
    const next = !enabled;
    await supabase.from("system_settings").upsert({ key: "auto_update_enabled", value: String(next) });
    setEnabled(next);
  };

  const runNow = async () => {
    setRunning(true);
    setResult(null);
    // فحص فوري: نفعّل الإعداد مؤقتًا (الدالة تتحقق منه) ثم نستدعيها يدويًا
    await supabase.from("system_settings").upsert({ key: "auto_update_enabled", value: "true" });
    const { data, error } = await supabase.functions.invoke("check-new-chapters");
    if (!enabled) await supabase.from("system_settings").upsert({ key: "auto_update_enabled", value: "false" });
    setResult(error ? { error: error.message } : data);
    setRunning(false);
    load();
  };

  return (
    <div style={{ maxWidth: 600, margin: "40px auto", fontFamily: "sans-serif", direction: "rtl" }}>
      <h1>التحديث التلقائي</h1>
      <p style={{ color: "#777" }}>
        عند التفعيل، pg_cron يستدعي دالة check-new-chapters كل 15 دقيقة (بعد ما
        تفعّل الجدولة من SQL Editor — شوف تعليمات migrations/0001_init.sql).
        الدالة تفحص الأعمال المربوطة بمصادر مرخّصة وتجمّع أي فصل جديد، وكل فصل
        جديد يبدأ ترجمته تلقائيًا بالخلفية.
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0" }}>
        <button onClick={toggle}>{enabled ? "إيقاف التحديث التلقائي" : "تفعيل التحديث التلقائي"}</button>
        <span style={{ color: enabled ? "green" : "#999" }}>{enabled ? "مفعّل ●" : "متوقف ○"}</span>
      </div>

      {lastRun && <p style={{ color: "#777" }}>آخر فحص: {new Date(lastRun).toLocaleString("ar")}</p>}

      <button onClick={runNow} disabled={running}>{running ? "جاري الفحص..." : "فحص الآن يدويًا"}</button>

      {result && (
        <div style={{ marginTop: 16, background: "#f5f5f5", padding: 12, borderRadius: 8 }}>
          {result.error ? (
            <p style={{ color: "crimson" }}>{result.error}</p>
          ) : (
            <p>تم فحص {result.checked} عمل، فصول جديدة: {result.new_chapters}</p>
          )}
        </div>
      )}
    </div>
  );
}
