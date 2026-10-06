import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import SeriesCard from "../components/SeriesCard";

export default function Home() {
  const [seriesList, setSeriesList] = useState([]);
  const [q, setQ] = useState("");
  const [continueReading, setContinueReading] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    let query = supabase.from("series").select("*, chapters(id, chapter_number)").order("updated_at", { ascending: false }).limit(40);
    if (q) query = query.or(`title_ar.ilike.%${q}%,title_original.ilike.%${q}%`);
    query.then(({ data }) => setSeriesList(data || []));
  }, [q]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setUser(session?.user || null));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return setContinueReading([]);
    supabase
      .from("reading_progress")
      .select("last_page, updated_at, chapter_id, series:series_id(id, title_ar, slug, cover_url), chapters:chapter_id(chapter_number)")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setContinueReading(data || []));
  }, [user]);

  return (
    <div>
      <div className="navbar container">
        <span className="logo">قارئ</span>
        <input
          className="search-bar"
          placeholder="ابحث عن مانهوا أو مانجا..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        {user ? (
          <button onClick={() => supabase.auth.signOut()}>تسجيل الخروج</button>
        ) : (
          <Link href="/login"><button>تسجيل الدخول</button></Link>
        )}
      </div>

      <div className="container">
        {continueReading.length > 0 && (
          <>
            <h2 style={{ marginTop: 24 }}>متابعة القراءة</h2>
            <div className="grid">
              {continueReading.map((c) => (
                <Link key={c.chapter_id} href={`/reader/${c.chapter_id}`} className="card">
                  <img src={c.series?.cover_url || "/placeholder-cover.png"} alt={c.series?.title_ar} />
                  <div className="card-body">
                    <p className="card-title">{c.series?.title_ar}</p>
                    <div className="card-meta"><span>الفصل {c.chapters?.chapter_number}</span></div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <h2 style={{ marginTop: 24 }}>كل الأعمال</h2>
        <div className="grid">
          {seriesList.map((s) => (
            <SeriesCard key={s.id} series={s} />
          ))}
          {seriesList.length === 0 && (
            <p style={{ color: "var(--text-dim)" }}>لا توجد نتائج بعد — أضف مانهوا من لوحة التحكم.</p>
          )}
        </div>
      </div>
    </div>
  );
}
