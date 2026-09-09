// Harbor plugin for ReadAllComics
const BASE = "https://readallcomics.com";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": BASE + "/"
};

async function getDoc(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await harbor.http(url, { responseType: "text", headers: HEADERS });
  if (!res.ok) throw new Error("HTTP " + res.status + " for " + path);
  return harbor.parseHtml(res.body);
}

function abs(url) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE + url;
  return BASE + "/" + url;
}

const plugin = {
  id: "readallcomics",
  name: "ReadAllComics",

  // Catalogo/Popolari
  async popular(offset, tagId) {
    const page = Math.floor(offset / 24) + 1;
    const path = page === 1 ? "/" : `/page/${page}/`;
    const doc = await getDoc(path);

    const items = doc.querySelectorAll(".post-story, article, .story-grid .story");
    const results = [];

    for (const el of items) {
      const a = el.querySelector("a");
      const img = el.querySelector("img");
      const title = a?.attr("title") || el.querySelector(".story-name, h2, h3")?.text()?.trim() || "";
      const href = a?.attr("href") || "";

      if (!href || !title) continue;

      results.push({
        id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, ""),
        title: title,
        cover: abs(img?.attr("src") || img?.attr("data-src"))
      });
    }

    return results;
  },

  // Ricerca Fumetti
  async search(query, offset, tagId) {
    const path = `/?story=${encodeURIComponent(query)}&s=${encodeURIComponent(query)}`;
    const doc = await getDoc(path);

    const links = doc.querySelectorAll("ul.story-list li a, .search-story a, article a");
    const results = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.attr("href") || "";
      const title = a.text()?.trim() || a.attr("title") || "";

      if (!href || seen.has(href) || !title) continue;
      seen.add(href);

      results.push({
        id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, ""),
        title: title,
        cover: undefined
      });
    }

    return results;
  },

  // Dettagli Fumetto
  async detail(id) {
    const doc = await getDoc("/" + id);
    const title = doc.querySelector("h1, .entry-title")?.text()?.trim() || id;
    const img = doc.querySelector(".description img, article img, .entry-content img");

    return {
      id,
      title,
      cover: abs(img?.attr("src")),
      description: doc.querySelector(".description, .entry-content, p")?.text()?.trim() || "Nessuna descrizione disponibile.",
      status: "Ongoing"
    };
  },

  // Lista Capitoli / Albi
  async chapters(id) {
    const doc = await getDoc("/" + id);
    const links = doc.querySelectorAll("ul.list-story li a, .entry-content a[href*='readallcomics.com']");
    const chapters = [];

    for (const a of links) {
      const href = a.attr("href") || "";
      const text = a.text()?.trim() || "";

      if (!href) continue;

      const numMatch = text.match(/#?(\d+(\.\d+)?)/);

      chapters.push({
        id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, ""),
        chapter: numMatch ? numMatch[1] : null,
        title: text || title,
        language: "en"
      });
    }

    return chapters;
  },

  // Estrazione Pagine / Immagini
  async pageUrls(chapterId) {
    const res = await harbor.http(BASE + "/" + chapterId, { responseType: "text", headers: HEADERS });
    if (!res.ok) return [];

    const doc = harbor.parseHtml(res.body);
    const images = doc.querySelectorAll(".page-container img, article img, .entry-content img");

    const urls = images
      .map((img) => abs(img.attr("src") || img.attr("data-src")))
      .filter((src) => src && !src.includes("logo") && !src.includes("banner") && !src.includes("avatar"));

    if (urls.length > 0) return urls;

    // Fallback con espressione regolare se le immagini sono iniettate via script
    const matches = [...res.body.matchAll(/https?:\/\/[^"'`\s]+\.(?:jpg|jpeg|png|webp)/gi)];
    return [...new Set(matches.map((m) => m[0]).filter((url) => !url.includes("logo") && !url.includes("banner")))];
  },

  async tags() {
    return [];
  }
};

return plugin;
