// Harbor plugin for ReadAllComics
const BASE = "https://readallcomics.com";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": BASE + "/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
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

  // Catalogo Popolari / Homepage
  async popular(offset, tagId) {
    const doc = await getDoc("/");
    
    // Seleziona tutti i link ai fumetti presenti nella lista/sidebar della home
    const links = doc.querySelectorAll("ul.story-list li a, .story-grid a, article a, .list-story a");
    const results = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.attr("href") || "";
      const title = a.text()?.trim() || a.attr("title") || "";

      if (!href || seen.has(href) || !title || title.length < 2) continue;
      // Esclude link di navigazione o categorie
      if (href.includes("/category/") || href.includes("/page/") || href === BASE || href === BASE + "/") continue;
      
      seen.add(href);

      const cleanId = href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, "");

      results.push({
        id: cleanId,
        title: title,
        cover: undefined
      });
    }

    return results;
  },

  // Ricerca Fumetti
  async search(query, offset, tagId) {
    const path = `/?story=${encodeURIComponent(query)}&s=${encodeURIComponent(query)}`;
    const doc = await getDoc(path);

    const links = doc.querySelectorAll("ul.story-list li a, .search-story a, article a, li a");
    const results = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.attr("href") || "";
      const title = a.text()?.trim() || a.attr("title") || "";

      if (!href || seen.has(href) || !title) continue;
      if (href.includes("/category/") || href === BASE) continue;
      
      seen.add(href);

      const cleanId = href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, "");

      results.push({
        id: cleanId,
        title: title,
        cover: undefined
      });
    }

    return results;
  },

  // Dettagli Fumetto
  async detail(id) {
    const doc = await getDoc("/" + id);
    const title = doc.querySelector("h1, .entry-title, .story-info h1")?.text()?.trim() || id;
    const img = doc.querySelector(".description img, article img, .entry-content img, .story-info img");

    return {
      id,
      title,
      cover: abs(img?.attr("src")),
      description: doc.querySelector(".description, .entry-content, p")?.text()?.trim() || "ReadAllComics Source",
      status: "Ongoing"
    };
  },

  // Lista Capitoli
  async chapters(id) {
    const doc = await getDoc("/" + id);
    const links = doc.querySelectorAll("ul.list-story li a, .entry-content a, .story-list a");
    const chapters = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.attr("href") || "";
      const text = a.text()?.trim() || "";

      if (!href || seen.has(href)) continue;
      if (href.includes("/category/")) continue;

      seen.add(href);
      const numMatch = text.match(/#?(\d+(\.\d+)?)/);
      const cleanId = href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, "");

      chapters.push({
        id: cleanId,
        chapter: numMatch ? numMatch[1] : null,
        title: text || id,
        language: "en"
      });
    }

    return chapters;
  },

  // Pagine / Immagini
  async pageUrls(chapterId) {
    const res = await harbor.http(BASE + "/" + chapterId, { responseType: "text", headers: HEADERS });
    if (!res.ok) return [];

    const doc = harbor.parseHtml(res.body);
    const images = doc.querySelectorAll(".page-container img, article img, .entry-content img, img");

    const urls = images
      .map((img) => abs(img.attr("src") || img.attr("data-src")))
      .filter((src) => src && (src.includes(".jpg") || src.includes(".png") || src.includes(".webp")) && !src.includes("logo") && !src.includes("banner") && !src.includes("avatar"));

    if (urls.length > 0) return urls;

    const matches = [...res.body.matchAll(/https?:\/\/[^"'`\s]+\.(?:jpg|jpeg|png|webp)/gi)];
    return [...new Set(matches.map((m) => m[0]).filter((url) => !url.includes("logo") && !url.includes("banner")))];
  },

  async tags() {
    return [];
  }
};

return plugin;
