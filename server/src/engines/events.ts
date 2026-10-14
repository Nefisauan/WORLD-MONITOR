import { randomUUID } from "node:crypto";
import type { AnalogueMatch, EventCluster, NewsItem } from "../types.js";
import { CATEGORIES, COUNTRY_KEYWORDS } from "../knowledge/taxonomy.js";
import { EPISODES } from "../knowledge/history.js";
import { clamp, jaccard, tokenize } from "../util.js";

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

export function buildClusters(items: NewsItem[], previous: EventCluster[], now = Date.now()): EventCluster[] {
  const cutoff = now - 36 * 3600 * 1000;
  const fresh = [...new Map(items.filter((it) => Date.parse(it.publishedAt) > cutoff &&
    Date.parse(it.publishedAt) <= now).map((it) => [it.id, it])).values()];
  // Pin known article membership before considering lexical similarity. Existing
  // event groups never merge implicitly; this avoids rewriting historical identity.
  type Group = { id: string; firstSeen: string | null; tokens: Set<string>; members: NewsItem[] };
  const groups = new Map<string, Group>();
  const owner = new Map<string, EventCluster>();
  for (const event of previous) for (const item of event.items) owner.set(item.id, event);
  const sorted = fresh.sort((a, b) => a.publishedAt.localeCompare(b.publishedAt) || a.id.localeCompare(b.id));
  const add = (group: Group, item: NewsItem) => {
    group.members.push(item);
    for (const token of tokenize(item.title)) group.tokens.add(token);
  };
  for (const item of sorted) {
    const old = owner.get(item.id);
    if (!old) continue;
    if (!groups.has(old.id)) groups.set(old.id, { id: old.id, firstSeen: old.firstSeen, tokens: new Set(), members: [] });
    add(groups.get(old.id)!, item);
  }
  for (const item of sorted) {
    if (owner.has(item.id)) continue;
    const tokens = tokenize(item.title);
    const match = [...groups.values()].map((g) => ({ g, similarity: jaccard(tokens, g.tokens) }))
      .filter((x) => x.similarity >= 0.45)
      .sort((a, b) => b.similarity - a.similarity || a.g.id.localeCompare(b.g.id))[0]?.g;
    const group = match ?? { id: randomUUID(), firstSeen: null, tokens: new Set<string>(), members: [] };
    groups.set(group.id, group);
    add(group, item);
  }
  const clusters = [...groups.values()];

  const out: EventCluster[] = clusters.map((c) => {
    // Representative = highest-tier source, then longest title
    const rep = [...c.members].sort(
      (a, b) => a.sourceTier - b.sourceTier || b.title.length - a.title.length,
    )[0];
    const catIds = [...new Set(c.members.flatMap((m) => classify(m.title)))];
    const countries = [...new Set(c.members.flatMap((m) => detectCountries(m.title)))];
    const sources = new Set(c.members.map((m) => m.source));
    const firstSeen = c.firstSeen ?? c.members.reduce(
      (min, m) => (m.detectedAt < min ? m.detectedAt : min),
      c.firstSeen ?? c.members[0].detectedAt,
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
    const ageHours = (now - new Date(lastUpdate).getTime()) / 3_600_000;
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

    const id = c.id;

    return {
      id,
      headline: rep.title,
      categories: catIds,
      items: c.members.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id)),
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
