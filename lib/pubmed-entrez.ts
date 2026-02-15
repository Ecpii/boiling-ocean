/**
 * NCBI Entrez E-utilities client for PubMed.
 * Base URL: https://eutils.ncbi.nlm.nih.gov/entrez/eutils/
 *
 * Setup:
 * 1. Optional: Create an NCBI account and get an API key from My NCBI
 *    (https://www.ncbi.nlm.nih.gov/account/) for higher rate limits (>3 req/sec).
 * 2. Set in .env.local:
 *    - NCBI_API_KEY=your_key   (optional but recommended for production)
 *    - ENTREZ_EMAIL=your@email (optional; NCBI requests this for contact)
 */

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

function buildParams(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  search.set("tool", "healthcare-ai-validator");
  const email = process.env.ENTREZ_EMAIL;
  const apiKey = process.env.NCBI_API_KEY;
  if (email) search.set("email", email);
  if (apiKey) search.set("api_key", apiKey);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") search.set(k, String(v));
  }
  return search.toString();
}

/** ESearch: find PMIDs matching a query. */
export async function esearch(options: {
  term: string;
  retmax?: number;
  retstart?: number;
  sort?: "relevance" | "pub_date" | "first_author" | "journal";
}): Promise<{ idList: string[]; count: number }> {
  const q = buildParams({
    db: "pubmed",
    term: options.term,
    retmax: options.retmax ?? 20,
    retstart: options.retstart ?? 0,
    sort: options.sort ?? "relevance",
    retmode: "json",
  });
  const res = await fetch(`${BASE}/esearch.fcgi?${q}`);
  if (!res.ok) throw new Error(`Entrez esearch failed: ${res.status}`);
  const data = (await res.json()) as {
    esearchresult?: { idlist?: string[]; count?: string };
  };
  const idList = data.esearchresult?.idlist ?? [];
  const count = parseInt(data.esearchresult?.count ?? "0", 10);
  return { idList, count };
}

/** ESummary: get document summaries for PMIDs (lightweight; good for validation). */
export async function esummary(pmids: string[]): Promise<PubMedSummary[]> {
  if (pmids.length === 0) return [];
  const id = [...new Set(pmids)].slice(0, 200).join(",");
  const q = buildParams({ db: "pubmed", id, retmode: "json" });
  const res = await fetch(`${BASE}/esummary.fcgi?${q}`);
  if (!res.ok) throw new Error(`Entrez esummary failed: ${res.status}`);
  const data = (await res.json()) as {
    result?: {
      uids?: string[];
      [pmid: string]: { uid: string; title?: string; authors?: { name: string }[]; pubdate?: string; source?: string } | string[] | undefined;
    };
  };
  const result = data.result ?? {};
  const uids = (result.uids ?? Object.keys(result).filter((k) => k !== "uids")) as string[];
  return uids
    .filter((uid) => typeof result[uid] === "object" && result[uid] !== null)
    .map((uid) => {
      const v = result[uid] as { uid: string; title?: string; authors?: { name: string }[]; pubdate?: string; source?: string };
      return {
        pmid: v.uid ?? uid,
        title: v.title ?? "",
        authors: Array.isArray(v.authors) ? v.authors.map((a) => (typeof a === "object" && a && "name" in a ? a.name : String(a))) : [],
        pubdate: v.pubdate ?? "",
        source: v.source ?? "",
      };
    });
}

/** EFetch: fetch abstracts for PMIDs (for agent context). */
export async function efetchAbstracts(pmids: string[]): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return [];
  const id = [...new Set(pmids)].slice(0, 50).join(",");
  const q = buildParams({ db: "pubmed", id, retmode: "xml" });
  const res = await fetch(`${BASE}/efetch.fcgi?${q}`);
  if (!res.ok) throw new Error(`Entrez efetch failed: ${res.status}`);
  const text = await res.text();
  return parsePubmedXml(text);
}

export interface PubMedSummary {
  pmid: string;
  title: string;
  authors: string[];
  pubdate: string;
  source: string;
}

export interface PubMedArticle {
  pmid: string;
  title: string;
  abstract: string;
  authors: string[];
  pubdate: string;
  source: string;
}

/** Simple XML parse for PubMed efetch XML (abstract, title, etc.). */
function parsePubmedXml(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = [];
  const articleBlocks = xml.split(/<PubmedArticle>/).slice(1);
  for (const block of articleBlocks) {
    const pmid = extractTag(block, "PMID");
    const title = extractTag(block, "ArticleTitle");
    const abstractBlock = block.match(/<Abstract>([\s\S]*?)<\/Abstract>/)?.[1] ?? "";
    const abstract = abstractBlock
      ? (abstractBlock.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g) ?? [])
          .map((n) => n.replace(/<[^>]+>/g, "").trim())
          .join(" ")
      : "";
    const authorList = block.match(/<AuthorList[^>]*>([\s\S]*?)<\/AuthorList>/)?.[1] ?? "";
    const authors = (authorList.match(/<Author[\s\S]*?<LastName>([^<]+)/g) ?? []).map((a) =>
      a.replace(/.*<LastName>([^<]+).*/, "$1")
    );
    const pubdate = extractTag(block, "PubDate") || extractTag(block, "MedlineDate") || "";
    const source = extractTag(block, "Title", "Journal") || "";
    articles.push({ pmid, title, abstract, authors, pubdate, source });
  }
  return articles;
}

function extractTag(block: string, tag: string, parent?: string): string {
  const pattern = parent
    ? new RegExp(`<${parent}[^>]*>[\\s\\S]*?<${tag}>([^<]*)</${tag}>`, "i")
    : new RegExp(`<${tag}>([^<]*)</${tag}>`, "i");
  const m = block.match(pattern);
  return m ? m[1].trim() : "";
}

/**
 * Validate PMIDs: returns which IDs exist in PubMed.
 * Batches in chunks of 200 (ESummary limit).
 */
export async function validatePmids(pmids: string[]): Promise<Map<string, boolean>> {
  const out = new Map<string, boolean>();
  const normalized = pmids.map((p) => p.replace(/\D/g, "")).filter(Boolean);
  if (normalized.length === 0) return out;
  for (let i = 0; i < normalized.length; i += 200) {
    const chunk = normalized.slice(i, i + 200);
    const summaries = await esummary(chunk);
    const found = new Set(summaries.map((s) => s.pmid));
    for (const id of chunk) {
      out.set(id, found.has(id));
    }
  }
  return out;
}
