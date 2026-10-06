// نفس فكرة sourceConnector.js بالباكند القديم: يعمل فقط مع مصادر عندها API فعلي
// وأنت تملك صلاحية استخدامه. ليس أداة زحف (scraping) لمواقع غير مرخّصة.

export function buildConnector(source: { base_url: string; api_key?: string }) {
  async function call(path: string) {
    const res = await fetch(`${source.base_url}${path}`, {
      headers: source.api_key ? { Authorization: `Bearer ${source.api_key}` } : {},
    });
    if (!res.ok) throw new Error(`source_error_${res.status}`);
    return res.json();
  }

  return {
    search: (title: string) => call(`/search?q=${encodeURIComponent(title)}`),
    listChapters: (ref: string) => call(`/series/${ref}/chapters`),
    getChapterPages: (ref: string, chapterNumber: number) =>
      call(`/series/${ref}/chapters/${chapterNumber}/pages`),
  };
}
