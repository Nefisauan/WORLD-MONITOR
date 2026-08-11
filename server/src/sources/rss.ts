import { XMLParser } from "fast-xml-parser";
import { fetchText, hashId } from "../util.js";
import type { NewsItem } from "../types.js";

// Curated RSS feeds. Tier reflects source-quality prior (1 = official/wire).

interface FeedSpec {
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

function normalizeItems(xml: string, spec: FeedSpec): NewsItem[] {
  const doc = parser.parse(xml);
  const channel = doc?.rss?.channel ?? doc?.feed;
  if (!channel) return [];
  let rawItems = channel.item ?? channel.entry ?? [];
  if (!Array.isArray(rawItems)) rawItems = [rawItems];
  const items: NewsItem[] = [];
  for (const it of rawItems) {
    const title = typeof it.title === "string" ? it.title : it.title?.["#text"];
    if (!title) continue;
    let url = "";
    if (typeof it.link === "string") url = it.link;
    else if (it.link?.["@_href"]) url = it.link["@_href"];
    else if (Array.isArray(it.link)) url = it.link[0]?.["@_href"] ?? "";
    const pub = it.pubDate ?? it.published ?? it.updated ?? it["dc:date"];
    const publishedAt = pub ? new Date(pub).toISOString() : new Date().toISOString();
    items.push({
      id: hashId(spec.source + title),
      title: String(title).trim(),
      url,
      source: spec.source,
      sourceTier: spec.tier,
      publishedAt,
      categories: [],
    });
  }
  return items;
}

export async function fetchAllFeeds(): Promise<{ items: NewsItem[]; failures: string[] }> {
  const failures: string[] = [];
  const results = await Promise.allSettled(
    FEEDS.map(async (spec) => normalizeItems(await fetchText(spec.url, { timeoutMs: 10_000 }), spec)),
  );
  const items: NewsItem[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") items.push(...r.value);
    else failures.push(FEEDS[i].source);
  });
  return { items, failures };
}
