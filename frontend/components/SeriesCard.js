import Link from "next/link";

const statusLabel = {
  ongoing: "مستمر",
  completed: "مكتمل",
  hiatus: "متوقف",
};

export default function SeriesCard({ series }) {
  const lastChapter = series.chapters?.[0];
  return (
    <Link href={`/series/${series.slug}`} className="card">
      <img src={series.cover_url || "/placeholder-cover.png"} alt={series.title_ar} />
      <div className="card-body">
        <p className="card-title">{series.title_ar}</p>
        <div className="card-meta">
          <span>{lastChapter ? `ف. ${lastChapter.chapter_number}` : "—"}</span>
          <span>{series.chapters_count ?? series.chapters?.length ?? 0} فصل</span>
        </div>
        <span className="badge">{statusLabel[series.status] || series.status}</span>
      </div>
    </Link>
  );
}

