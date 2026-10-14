import { createHash } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { fetchText } from "../util.js";
import type { NewsItem } from "../types.js";

// Curated RSS feeds. Tier reflects source-quality prior (1 = official/wire).

export interface FeedSpec {
  url: string;
  source: string;
  tier: number;
}

const FEEDS: FeedSpec[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World", tier: 2 },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml", source: "BBC Business", tier: 2 },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera", tier: 3 },
  { url: "https://www.theguardian.com/world/rss", source: "Guardian World", tier: 3 },
  { url: "https://www.cnbc.com/id/100003114/device/rss/rss.html", source: "CNBC", tier: 2 },
  { url: "https://www.cnbc.com/id/20910258/device/rss/rss.html", source: "CNBC Economy", tier: 2 },
  { url: "https://feeds.content.dowjones.io/public/rss/mw_topstories", source: "MarketWatch", tier: 2 },
  { url: "https://www.federalreserve.gov/feeds/press_all.xml", source: "Federal Reserve", tier: 1 },
  { url: "https://www.ecb.europa.eu/rss/press.html", source: "ECB", tier: 1 },
  { url: "https://www.eia.gov/rss/todayinenergy.xml", source: "EIA", tier: 1 },
  { url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml", source: "WSJ Markets", tier: 2 },
  { url: "https://feeds.a.dj.com/rss/RSSWorldNews.xml", source: "WSJ World", tier: 2 },
];

const parser = new XMLParser({ ignoreAttributes: false });

export function normalizeItems(xml: string, spec: FeedSpec, now = new Date()): { items: NewsItem[]; rejected: number } {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.feed;
  if (!channel) throw new Error("Unrecognized RSS/Atom document");
  let rawItems = channel.item ?? channel.entry ?? [];
  if (!Array.isArray(rawItems)) rawItems = [rawItems];
  const items: NewsItem[] = [];
  let rejected = 0;
  for (const it of rawItems) {
    if (!it || typeof it !== "object") { rejected++; continue; }
    const title = typeof it.title === "string" ? it.title : it.title?.["#text"];
    if (!title || typeof title !== "string") { rejected++; continue; }
    let url = "";
    if (typeof it.link === "string") url = it.link;
    else if (it.link?.["@_href"]) url = it.link["@_href"];
    else if (Array.isArray(it.link)) url = it.link[0]?.["@_href"] ?? "";
    const pub = it.pubDate ?? it.published ?? it.updated ?? it["dc:date"];
    const publishedMs = typeof pub === "string" ? Date.parse(pub) : NaN;
    let safeUrl: URL;
    try { safeUrl = new URL(url); } catch { rejected++; continue; }
    if (!["http:", "https:"].includes(safeUrl.protocol) || safeUrl.username || safeUrl.password ||
        !Number.isFinite(publishedMs) || publishedMs > now.getTime()) { rejected++; continue; }
    safeUrl.hash = "";
    const publishedAt = new Date(publishedMs).toISOString();
    items.push({
      id: createHash("sha256").update(spec.source + "\n" + safeUrl.href).digest("hex"),
      title: String(title).trim(),
      url: safeUrl.href,
      source: spec.source,
      sourceTier: spec.tier,
      publishedAt,
      detectedAt: now.toISOString(),
      categories: [],
    });
  }
  return { items, rejected };
}

export async function fetchAllFeeds(): Promise<{ items: NewsItem[]; failures: string[]; rejected: number }> {
  const failures: string[] = [];
  const results = await Promise.allSettled(
    FEEDS.map(async (spec) => normalizeItems(await fetchText(spec.url, { timeoutMs: 10_000 }), spec)),
  );
  const items: NewsItem[] = [];
  let rejected = 0;
  results.forEach((r, i) => {
    if (r.status === "fulfilled") { items.push(...r.value.items); rejected += r.value.rejected; }
    else failures.push(FEEDS[i].source);
  });
  return { items, failures, rejected };
}
