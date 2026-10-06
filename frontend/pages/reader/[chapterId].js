import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";

// يرسم النص المترجم فوق الصورة داخل المتصفح (بدل ما يُجهّز بالسيرفر)
function TranslatedPage({ page }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      for (const block of page.translated_text || []) {
        if (!block.translated) continue;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(block.x, block.y, block.width, block.height);
        ctx.fillStyle = "#000000";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.direction = "rtl";
        const fontSize = Math.max(12, Math.min(28, Math.floor(block.height / 3)));
        ctx.font = `${fontSize}px Tajawal, sans-serif`;
        wrapText(ctx, block.translated, block.x + block.width / 2, block.y + block.height / 2, block.width - 8, fontSize + 4);
      }
    };
    img.src = page.original_image_url;
  }, [page]);

  return <canvas ref={canvasRef} style={{ maxWidth: "100%", display: "block" }} />;
}

function wrapText(ctx, text, cx, cy, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && current) { lines.push(current); current = w; }
    else current = test;
  }
  if (current) lines.push(current);
  const startY = cy - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => ctx.fillText(line, cx, startY + i * lineHeight));
}

export default function ReaderPage() {
  const router = useRouter();
  const { chapterId } = router.query;
  const [chapter, setChapter] = useState(null);
  const [pages, setPages] = useState([]);
  const [user, setUser] = useState(null);
  const containerRef = useRef(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!chapterId) return;
    supabase.from("chapters").select("*").eq("id", chapterId).single().then(({ data }) => setChapter(data));
    supabase.from("pages").select("*").eq("chapter_id", chapterId).order("page_number").then(({ data }) => setPages(data || []));
  }, [chapterId]);

  useEffect(() => {
    if (!user || !chapter) return;
    const onScroll = debounce(() => {
      const imgs = containerRef.current?.querySelectorAll("canvas") || [];
      let current = 1;
      imgs.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight / 2) current = i + 1;
      });
      supabase.from("reading_progress").upsert({
        user_id: user.id, series_id: chapter.series_id, chapter_id: chapter.id,
        last_page: current, updated_at: new Date().toISOString(),
      });
    }, 1500);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [user, chapter]);

  if (!chapter) return <div style={{ background: "#000", minHeight: "100vh" }} />;

  return (
    <div className="reader-page" ref={containerRef}>
      <div style={{ width: "100%", maxWidth: 900, display: "flex", justifyContent: "space-between", padding: "12px 16px", color: "#fff" }}>
        <button onClick={() => router.back()} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer" }}>
          ← رجوع لقائمة الفصول
        </button>
        <span>الفصل {chapter.chapter_number}</span>
      </div>

      {pages.map((p) => <TranslatedPage key={p.id} page={p} />)}
      {pages.length === 0 && <p style={{ color: "#888", padding: 40 }}>لا توجد صفحات جاهزة بعد لهذا الفصل.</p>}
    </div>
  );
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
