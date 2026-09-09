// Harbor Extension - ReadAllComics
const BASE = "https://readallcomics.net";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": BASE + "/"
};

async function getDoc(path) {
  const url = path.startsWith("http") ? path : BASE + (path.startsWith("/") ? path : "/" + path);
  const res = await harbor.http(url, { responseType: "text", headers: HEADERS });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return harbor.parseHtml(res.body);
}

function cleanId(url) {
  if (!url) return "";
  return url.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, "");
}

function absUrl(url) {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return "https:" + url;
  if (url.startsWith("/")) return BASE + url;
  return BASE + "/" + url;
}

const plugin = {
  id: "readallcomics",
  name: "ReadAllComics",

  async popular(offset, tagId) {
    const page = Math.floor(offset / 20) + 1;
    const path = page === 1 ? "/" : `/page/${page}/`;
    const doc = await getDoc(path);

    const items = doc.querySelectorAll("article, .post, .story, li");
    const results = [];
    const seen = new Set();

    for (const el of items) {
      const a = el.querySelector("a");
      const img = el.querySelector("img");
      const title = (a?.text() || a?.attr("title") || "").trim();
      const href = a?.attr("href") || "";

      if (!href || !title || title.length < 3 || seen.has(href)) continue;
      if (href.includes("/category/") || href.includes("/tag/") || href === BASE || href === BASE + "/") continue;

      seen.add(href);

      results.push({
        id: cleanId(href),
        title: title,
        cover: absUrl(img?.attr("src") || img?.attr("data-src"))
      });
    }

    return results;
  },

  async search(query, offset, tagId) {
    const path = `/?s=${encodeURIComponent(query)}`;
    const doc = await getDoc(path);

    const links = doc.querySelectorAll("article a, .post a, .story a, ul a");
    const results = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.attr("href") || "";
      const title = (a.text() || a.attr("title") || "").trim();

      if (!href || !title || title.length < 3 || seen.has(href)) continue;
      if (href.includes("/category/") || href.includes("/tag/") || href === BASE) continue;

      seen.add(href);

      results.push({
        id: cleanId(href),
        title: title,
        cover: undefined
      });
    }

    return results;
  },

  async detail(id) {
    const doc = await getDoc("/" + id);
    const title = doc.querySelector("h1, .entry-title")?.text()?.trim() || id;
    const img = doc.querySelector(".entry-content img, article img, img");

    return {
      id,
      title,
      cover: absUrl(img?.attr("src") || img?.attr("data-src")),
      description: doc.querySelector(".entry-content, .description, p")?.text()?.trim() || "ReadAllComics",
      status: "Ongoing"
    };
  },

  async chapters(id) {
    const doc = await getDoc("/" + id);
    const links = doc.querySelectorAll(".entry-content a, article a, ul a");
    const chapters = [];
    const seen = new Set();

    for (const a of links) {
      const href = a.attr("href") || "";
      const text = (a.text() || "").trim();

      if (!href || seen.has(href)) continue;
      if (href.includes("/category/") || href.includes("/tag/")) continue;

      seen.add(href);
      const numMatch = text.match(/#?(\d+(\.\d+)?)/);

      chapters.push({
        id: cleanId(href),
        chapter: numMatch ? numMatch[1] : null,
        title: text || id,
        language: "en"
      });
    }

    return chapters;
  },

  async pageUrls(chapterId) {
    const res = await harbor.http(BASE + "/" + chapterId, { responseType: "text", headers: HEADERS });
    if (!res.ok) return [];

    const doc = harbor.parseHtml(res.body);
    const images = doc.querySelectorAll(".entry-content img, article img, img");

    const urls = images
      .map((img) => absUrl(img.attr("src") || img.attr("data-src")))
      .filter((src) => src && (src.includes(".jpg") || src.includes(".png") || src.includes(".webp")) && !src.includes("logo") && !src.includes("banner"));

    if (urls.length > 0) return urls;

    const matches = [...res.body.matchAll(/https?:\/\/[^"'`\s]+\.(?:jpg|jpeg|png|webp)/gi)];
    return [...new Set(matches.map((m) => m[0]).filter((url) => !url.includes("logo") && !url.includes("banner")))];
  },

  async tags() {
    return [];
  }
};

return plugin;
