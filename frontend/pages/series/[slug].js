import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { supabase } from "../../lib/supabaseClient";

export default function SeriesPage() {
  const router = useRouter();
  const { slug } = router.query;
  const [series, setSeries] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [favorited, setFavorited] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!slug) return;
    supabase.from("series").select("*").eq("slug", slug).single().then(({ data }) => {
      setSeries(data);
      if (data) {
        supabase.from("chapters").select("id, chapter_number, title_ar, status")
          .eq("series_id", data.id).order("chapter_number", { ascending: false })
          .then(({ data: ch }) => setChapters(ch || []));
      }
    });
  }, [slug]);

  useEffect(() => {
    if (!user || !series) return;
    supabase.from("favorites").select("*").eq("user_id", user.id).eq("series_id", series.id).maybeSingle()
      .then(({ data }) => setFavorited(!!data));
  }, [user, series]);

  const toggleFavorite = async () => {
    if (!user) return router.push("/login");
    if (favorited) {
      await supabase.from("favorites").delete().eq("user_id", user.id).eq("series_id", series.id);
      setFavorited(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, series_id: series.id });
      setFavorited(true);
    }
  };

  if (!series) return <div className="container" style={{ padding: 40 }}>...جاري التحميل</div>;

  return (
    <div className="container" style={{ padding: "30px 20px" }}>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        <img src={series.cover_url || "/placeholder-cover.png"} alt={series.title_ar} style={{ width: 220, borderRadius: 12 }} />
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>{series.title_ar}</h1>
          {series.title_original && <p style={{ color: "var(--text-dim)" }}>{series.title_original}</p>}
          <p>{series.description_ar}</p>
          <p style={{ color: "var(--text-dim)" }}>
            {series.author && `الكاتب: ${series.author}`} {series.artist && `— الرسام: ${series.artist}`}
          </p>
          <span className="badge">{series.status}</span>
          <div style={{ marginTop: 16 }}>
            <button onClick={toggleFavorite}>{favorited ? "★ في المفضلة" : "☆ أضف للمفضلة"}</button>
          </div>
        </div>
      </div>

      <h2 style={{ marginTop: 40 }}>الفصول ({chapters.length})</h2>
      <ul className="chapter-list">
        {chapters.map((ch) => (
          <li key={ch.id}>
            <Link href={`/reader/${ch.id}`}>الفصل {ch.chapter_number} {ch.title_ar ? `— ${ch.title_ar}` : ""}</Link>
            <span style={{ color: "var(--text-dim)" }}>{ch.status}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
