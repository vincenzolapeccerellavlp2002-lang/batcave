// Harbor manga source plugin for batcave.biz
const BASE = "https://batcave.biz";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Referer": BASE + "/",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "X-Requested-With": "XMLHttpRequest"
};

async function getDoc(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await harbor.http(url, { responseType: "text", headers: HEADERS });
  if (!res.ok) throw new Error("http " + res.status + " for " + path);
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
  id: "batcave-biz",
  name: "Batcave",

  async popular(offset, tagId) {
    const page = Math.floor(offset / 48) + 1;
    const path = tagId ? `/genre/${encodeURIComponent(tagId)}/page/${page}/` : `/page/${page}/`;
    const doc = await getDoc(path);

    // Selettore generico per catturare qualsiasi elemento scheda/link
    const cards = doc.querySelectorAll("a[href*='/comic/'], a[href*='/manga/'], .poster-grid a, .item a");
    const results = [];
    const seen = new Set();

    for (const a of cards) {
      const href = a.attr("href") || "";
      const img = a.querySelector("img") || a.parentNode?.querySelector("img");
      const title = a.attr("title") || a.text()?.trim() || img?.attr("alt") || "";
      
      if (!href || seen.has(href) || !title) continue;
      seen.add(href);

      results.push({
        id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, ""),
        title: title,
        cover: abs(img?.attr("data-src") || img?.attr("src") || img?.attr("data-lazy-src"))
      });
    }

    return results;
  },

  async search(query, offset, tagId) {
    const page = Math.floor(offset / 48) + 1;
    const path = `/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}&search_start=${page}`;
    const doc = await getDoc(path);

    return doc.querySelectorAll("a[href*='/comic/'], .search-result a").map((a) => {
      const href = a.attr("href") || "";
      const img = a.querySelector("img");
      if (!href) return null;
      return {
        id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, ""),
        title: (a.attr("title") || a.text() || "").trim(),
        cover: abs(img?.attr("data-src") || img?.attr("src"))
      };
    }).filter((item) => item && item.title);
  },

  async detail(id) {
    const doc = await getDoc("/" + id);
    const title = doc.querySelector("h1")?.text()?.trim() || id;
    const img = doc.querySelector("img[src*='cover'], img[src*='poster'], article img");

    return {
      id,
      title,
      cover: abs(img?.attr("data-src") || img?.attr("src")),
      description: doc.querySelector(".description, .entry-content, p")?.text()?.trim() || "",
      status: "Ongoing"
    };
  },

  async chapters(id) {
    const doc = await getDoc("/" + id);
    return doc.querySelectorAll("a[href*='chapter'], a[href*='ch-']").map((a) => {
      const href = a.attr("href") || "";
      const text = a.text()?.trim() || "";
      const match = text.match(/\d+(\.\d+)?/);
      return {
        id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, ""),
        chapter: match ? match[0] : null,
        title: text,
        language: "en"
      };
    }).filter((c) => c.id);
  },

  async pageUrls(chapterId) {
    const res = await harbor.http(BASE + "/" + chapterId, { responseType: "text", headers: HEADERS });
    if (!res.ok) return [];

    const doc = harbor.parseHtml(res.body);
    const domPages = doc.querySelectorAll("img").map((img) => abs(img.attr("data-src") || img.attr("src"))).filter((src) => src && (src.includes("/uploads/") || src.includes("/chapters/") || src.includes(".webp")));

    if (domPages.length > 0) return domPages;

    const matches = [...res.body.matchAll(/https?:\/\/[^"'`\s]+\.(?:jpg|jpeg|png|webp)/gi)];
    return [...new Set(matches.map((m) => m[0]).filter((url) => !url.includes("logo") && !url.includes("avatar")))];
  },

  async tags() {
    return [];
  }
};

return plugin;
