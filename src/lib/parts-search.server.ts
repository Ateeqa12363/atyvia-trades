/**
 * Live parts pricing lookup via Firecrawl search (gateway-backed connector).
 * Searches the tradesperson's preferred merchants for current prices.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";

const MERCHANT_DOMAINS: Record<string, string> = {
  screwfix: "screwfix.com",
  toolstation: "toolstation.com",
  wickes: "wickes.co.uk",
  plumbworld: "plumbworld.co.uk",
  "b&q": "diy.com",
  bq: "diy.com",
  "city plumbing": "cityplumbing.co.uk",
  plumbase: "plumbase.co.uk",
  travis: "travisperkins.co.uk",
  "travis perkins": "travisperkins.co.uk",
  jewson: "jewson.co.uk",
  cef: "cef.co.uk",
  edmundson: "edmundson-electrical.co.uk",
  "selco": "selcobw.com",
  "howdens": "howdens.com",
  "victorian plumbing": "victorianplumbing.co.uk",
  amazon: "amazon.co.uk",
};

export function merchantDomains(preferred: string | null | undefined): string[] {
  const raw = (preferred ?? "").toLowerCase();
  const found = new Set<string>();
  for (const [name, domain] of Object.entries(MERCHANT_DOMAINS)) {
    if (raw.includes(name)) found.add(domain);
  }
  if (found.size === 0) {
    ["screwfix.com", "toolstation.com", "wickes.co.uk"].forEach((d) => found.add(d));
  }
  return [...found].slice(0, 4);
}

export type PartResult = { query: string; title: string; url: string; snippet: string };

async function searchOne(query: string, domains: string[], keys: { lovable: string; firecrawl: string }) {
  const scoped = `${query} price ${domains.map((d) => `site:${d}`).join(" OR ")}`;
  const res = await fetch(`${GATEWAY}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${keys.lovable}`,
      "X-Connection-Api-Key": keys.firecrawl,
    },
    body: JSON.stringify({ query: scoped, limit: 3, country: "gb", lang: "en" }),
  });
  if (!res.ok) {
    console.warn("[firecrawl] search failed", res.status, (await res.text()).slice(0, 300));
    return [] as PartResult[];
  }
  const json = (await res.json()) as {
    data?: Array<{ url?: string; title?: string; description?: string }> | { web?: Array<{ url?: string; title?: string; description?: string }> };
  };
  const list = Array.isArray(json.data) ? json.data : (json.data?.web ?? []);
  return list.slice(0, 3).map((r) => ({
    query,
    title: (r.title ?? "").slice(0, 160),
    url: r.url ?? "",
    snippet: (r.description ?? "").slice(0, 300),
  }));
}

/** Runs up to 6 merchant searches in parallel and returns flattened results. */
export async function searchParts(
  queries: string[],
  preferredMerchants: string | null | undefined,
): Promise<{ results: PartResult[]; merchants: string[] }> {
  const lovable = process.env.LOVABLE_API_KEY;
  const firecrawl = process.env.FIRECRAWL_API_KEY;
  const domains = merchantDomains(preferredMerchants);
  if (!lovable || !firecrawl || !queries.length) return { results: [], merchants: domains };

  const picked = queries.filter((q) => q && q.trim()).slice(0, 6);
  const batches = await Promise.all(
    picked.map((q) =>
      searchOne(q.trim(), domains, { lovable, firecrawl }).catch((e) => {
        console.warn("[firecrawl] search error", e);
        return [] as PartResult[];
      }),
    ),
  );
  return { results: batches.flat(), merchants: domains };
}
