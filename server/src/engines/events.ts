import type { AnalogueMatch, EventCluster, NewsItem } from "../types.js";
import { CATEGORIES, COUNTRY_KEYWORDS } from "../knowledge/taxonomy.js";
import { EPISODES } from "../knowledge/history.js";
import { clamp, hashId, jaccard, tokenize } from "../util.js";

// Event engine: classify -> cluster (dedupe) -> score -> attach analogues +
// transmission chains. All scoring is deterministic and explainable.

export function classify(title: string): string[] {
  const lower = " " + title.toLowerCase() + " ";
  const cats: string[] = [];
  for (const cat of CATEGORIES) {
    if (cat.keywords.some((k) => lower.includes(k))) cats.push(cat.id);
  }
  return cats;
}

function detectCountries(title: string): string[] {
  const lower = " " + title.toLowerCase() + " ";
  const found: string[] = [];
  for (const [iso, kws] of Object.entries(COUNTRY_KEYWORDS)) {
    if (kws.some((k) => lower.includes(k))) found.push(iso);
  }
  return found;
}

function hasStrongKeyword(title: string, catIds: string[]): boolean {
  const lower = title.toLowerCase();
  return catIds.some((id) => {
    const cat = CATEGORIES.find((c) => c.id === id);
    return cat?.strongKeywords?.some((k) => lower.includes(k)) ?? false;
  });
}

const TIER_CREDIBILITY: Record<number, number> = { 1: 99, 2: 95, 3: 88, 4: 70 };

function matchAnalogues(catIds: string[], strong: boolean): AnalogueMatch[] {
  const tagSet = new Set(catIds.flatMap((id) => CATEGORIES.find((c) => c.id === id)?.analogueTags ?? []));
  if (!tagSet.size) return [];
  const scored = EPISODES.map((ep) => {
    let overlap = 0;
    for (const t of ep.tags) if (tagSet.has(t)) overlap++;
    const union = new Set([...ep.tags, ...tagSet]).size;
    let sim = union ? overlap / union : 0;
    // Magnitude affinity: strong-keyword events match big-magnitude episodes better.
    const magFit = strong ? ep.magnitude / 3 : 1 - Math.abs(ep.magnitude - 1.5) / 3;
    sim = sim * 0.8 + magFit * 0.2 * (sim > 0 ? 1 : 0);
    return { ep, sim };
  })
    .filter((s) => s.sim > 0.12)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 4);

  return scored.map(({ ep, sim }) => ({
    episodeId: ep.id,
    name: ep.name,
    year: ep.year,
    similarity: Math.round(sim * 100) / 100,
    summary: ep.summary,
    outcomes: ep.outcomes,
  }));
}

export function buildClusters(items: NewsItem[], previous: EventCluster[]): EventCluster[] {
  // Keep last 36h of news
  const cutoff = Date.now() - 36 * 3600 * 1000;
  const fresh = items.filter((it) => new Date(it.publishedAt).getTime() > cutoff);

  // Greedy clustering by title similarity
  const clusters: { rep: NewsItem; tokens: Set<string>; members: NewsItem[] }[] = [];
  const sorted = [...fresh].sort(
    (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime(),
  );
  for (const item of sorted) {
    const toks = tokenize(item.title);
    let placed = false;
    for (const c of clusters) {
      if (jaccard(toks, c.tokens) >= 0.45) {
        c.members.push(item);
        for (const t of toks) c.tokens.add(t);
        placed = true;
        break;
      }
    }
    if (!placed) clusters.push({ rep: item, tokens: toks, members: [item] });
  }

  const prevById = new Map(previous.map((c) => [c.id, c]));

  const out: EventCluster[] = clusters.map((c) => {
    // Representative = highest-tier source, then longest title
    const rep = [...c.members].sort(
      (a, b) => a.sourceTier - b.sourceTier || b.title.length - a.title.length,
    )[0];
    const catIds = [...new Set(c.members.flatMap((m) => classify(m.title)))];
    const countries = [...new Set(c.members.flatMap((m) => detectCountries(m.title)))];
    const sources = new Set(c.members.map((m) => m.source));
    const firstSeen = c.members.reduce(
      (min, m) => (m.publishedAt < min ? m.publishedAt : min),
      c.members[0].publishedAt,
    );
    const lastUpdate = c.members.reduce(
      (max, m) => (m.publishedAt > max ? m.publishedAt : max),
      c.members[0].publishedAt,
    );
    const strong = hasStrongKeyword(c.members.map((m) => m.title).join(" "), catIds);

    // ---- Impact score (0-100), decomposed ----
    const catBase = Math.max(0, ...catIds.map((id) => CATEGORIES.find((x) => x.id === id)?.baseImpact ?? 0));
    const corroboration = clamp((sources.size - 1) * 6, 0, 18);
    const magnitude = strong ? 12 : 0;
    const bestTier = Math.min(...c.members.map((m) => m.sourceTier));
    const credibilityBoost = bestTier === 1 ? 6 : bestTier === 2 ? 3 : 0;
    const ageHours = (Date.now() - new Date(lastUpdate).getTime()) / 3_600_000;
    const recencyPenalty = clamp(ageHours * 1.2, 0, 25);
    const scopeBoost = clamp(countries.length * 2, 0, 8);
    const uncategorizedPenalty = catIds.length === 0 ? 35 : 0;

    const impactScore = Math.round(
      clamp(catBase * 0.6 + corroboration + magnitude + credibilityBoost + scopeBoost - recencyPenalty - uncategorizedPenalty, 0, 100),
    );

    const credibility = Math.round(
      clamp(
        TIER_CREDIBILITY[bestTier] ?? 70 + Math.min(sources.size * 1.5, 6) - (sources.size === 1 && bestTier >= 3 ? 10 : 0),
        0,
        99,
      ),
    );

    const primaryCat = catIds
      .map((id) => CATEGORIES.find((x) => x.id === id)!)
      .sort((a, b) => b.baseImpact - a.baseImpact)[0];

    const id = prevById.has(hashId(rep.title)) ? hashId(rep.title) : hashId(rep.title);

    return {
      id,
      headline: rep.title,
      categories: catIds,
      items: c.members.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 12),
      sourceCount: sources.size,
      firstSeen,
      lastUpdate,
      impactScore,
      impactBreakdown: {
        category_prior: Math.round(catBase * 0.6),
        corroboration,
        magnitude_keywords: magnitude,
        source_tier: credibilityBoost,
        geographic_scope: scopeBoost,
        recency_decay: -Math.round(recencyPenalty),
        uncategorized: -uncategorizedPenalty,
      },
      credibility,
      countries,
      exposures: primaryCat?.exposures ?? [],
      transmission: primaryCat?.transmission ?? null,
      analogues: catIds.length ? matchAnalogues(catIds, strong) : [],
    };
  });

  return out.sort((a, b) => b.impactScore - a.impactScore);
}
