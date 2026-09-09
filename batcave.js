// Harbor manga source plugin for batcave.biz
const BASE = "https://batcave.biz";

async function getDoc(path) {
  const url = path.startsWith("http") ? path : BASE + path;
  const res = await harbor.http(url, { responseType: "text" });
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

function cardToSummary(el) {
  const link = el.querySelector("a.poster-link") || el.querySelector("a");
  const img = el.querySelector("img");
  if (!link) return null;
  const href = link.attr("href") || "";
  
  return {
    id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, "").replace(/\/$/, ""),
    title: (link.attr("title") || el.querySelector(".title, .poster-title")?.text() || "").trim(),
    cover: abs(img?.attr("data-src") || img?.attr("src")),
  };
}

const plugin = {
  id: "batcave-biz",
  name: "Batcave",

  async popular(offset, tagId) {
    const page = Math.floor(offset / 48) + 1;
    const path = tagId 
      ? `/genre/${encodeURIComponent(tagId)}/page/${page}/`
      : `/comic-list/page/${page}/`;
    
    const doc = await getDoc(path);
    return doc.querySelectorAll(".poster-grid .poster-item, .comic-grid .item").map(cardToSummary).filter(Boolean);
  },

  async search(query, offset, tagId) {
    const page = Math.floor(offset / 48) + 1;
    const path = `/index.php?do=search&subaction=search&story=${encodeURIComponent(query)}&search_start=${page}`;
    
    const doc = await getDoc(path);
    return doc.querySelectorAll(".search-result .item, .poster-grid .poster-item").map(cardToSummary).filter(Boolean);
  },

  async detail(id) {
    const doc = await getDoc("/" + id);
    const root = doc.querySelector(".comic-detail, .page-content");
    if (!root) return null;

    return {
      id,
      title: root.querySelector("h1, .comic-title")?.text()?.trim() || id,
      altTitle: root.querySelector(".alt-name, .secondary-title")?.text()?.trim(),
      cover: abs(root.querySelector(".poster img, .cover img")?.attr("src")),
      description: root.querySelector(".description, .summary-content")?.text()?.trim(),
      status: root.querySelector(".status-info")?.text()?.trim(),
      author: root.querySelector(".author-info, .artist-info")?.text()?.trim(),
      lastChapter: root.querySelector(".chapter-list a")?.text()?.trim(),
    };
  },

  async chapters(id) {
    const doc = await getDoc("/" + id);
    return doc
      .querySelectorAll(".chapter-list a, .chapters-list a")
      .map((a) => {
        const href = a.attr("href") || "";
        const titleText = a.text()?.trim() || "";
        const numMatch = titleText.match(/(?:ch|chapter|#)\s*(\d+(?:\.\d+)?)/i);
        
        return {
          id: href.replace(/^https?:\/\/[^\/]+/, "").replace(/^\//, ""),
          chapter: numMatch ? numMatch[1] : null,
          title: titleText,
          volume: null,
          pages: 0,
          language: "en",
          publishAt: a.querySelector(".date")?.attr("datetime") || undefined,
        };
      })
      .filter((c) => c.id);
  },

  async pageUrls(chapterId) {
    const res = await harbor.http(BASE + "/" + chapterId, { responseType: "text" });
    if (!res.ok) throw new Error("http " + res.status + " for chapter " + chapterId);

    const doc = harbor.parseHtml(res.body);
    const domPages = doc
      .querySelectorAll(".reader-images img, .chapter-content img")
      .map((img) => abs(img.attr("data-src") || img.attr("src")))
      .filter(Boolean);

    if (domPages.length > 0) return domPages;

    const matches = [...res.body.matchAll(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi)];
    if (matches.length > 0) {
      const urls = matches
        .map((m) => m[0])
        .filter((url) => !url.includes("logo") && !url.includes("banner") && !url.includes("avatar"));
      return [...new Set(urls)];
    }

    return [];
  },

  async tags() {
    const doc = await getDoc("/");
    return doc
      .querySelectorAll(".genre-list a, .genres-menu a")
      .map((a) => {
        const href = a.attr("href") || "";
        const tagId = href.replace(/^.*\/genre\//, "").replace(/\/$/, "");
        return { id: tagId, name: a.text().trim(), group: "Genre" };
      })
      .filter((t) => t.id && t.name);
  },
};

// Necessario affinché Harbor riceva l'oggetto del plugin
return plugin;
