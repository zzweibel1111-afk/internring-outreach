import * as cheerio from "cheerio";
import { prisma } from "./db";
import { extractContacts, findOfficialWebsite } from "./ai";
import { timeZoneForState } from "./timezone";
import { reviewModeOn } from "./settings";
import { createInitialDraft } from "./drafts";

const PAGE_KEYWORDS = [
  "directory", "staff", "faculty", "leadership", "administration", "admin",
  "about", "our-team", "team", "people", "advancement", "development",
  "giving", "alumni", "contact", "head-of-school", "office",
];

const UA = "Mozilla/5.0 (compatible; InternRingOutreach/1.0; +contact via outreach email)";

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html" },
      redirect: "follow",
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") ?? "";
    if (!ct.includes("html")) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function pageText(html: string): string {
  const $ = cheerio.load(html);
  $("script, style, noscript, svg, nav, footer").remove();
  // mailto links often carry the only machine-readable email - surface them
  $("a[href^='mailto:']").each((_, el) => {
    const addr = ($(el).attr("href") ?? "").replace("mailto:", "").split("?")[0];
    $(el).append(` <${addr}> `);
  });
  return $("body").text().replace(/\s+/g, " ").trim();
}

function candidateLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  const ranked: { url: string; rank: number }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    let abs: string;
    try {
      abs = new URL(href, baseUrl).toString();
    } catch {
      return;
    }
    const base = new URL(baseUrl);
    const u = new URL(abs);
    if (u.hostname !== base.hostname) return; // stay on the school's own site
    abs = abs.split("#")[0];
    if (seen.has(abs)) return;
    const hay = (u.pathname + " " + $(el).text()).toLowerCase();
    const rank = PAGE_KEYWORDS.reduce((r, kw) => (hay.includes(kw) ? r + 1 : r), 0);
    if (rank > 0) {
      seen.add(abs);
      ranked.push({ url: abs, rank });
    }
  });
  return ranked.sort((a, b) => b.rank - a.rank).slice(0, 6).map((r) => r.url);
}

// Many school directory/staff listing pages link each name to its own bio
// page, and the email often only lives on that individual page, not the
// listing. Given the HTML of a "hub" page we already fetched, follow links
// that live under the same path prefix - that pattern reliably finds the
// individual profile pages.
function profileLinks(html: string, hubUrl: string): string[] {
  const $ = cheerio.load(html);
  const base = new URL(hubUrl);
  const hubPrefix = base.pathname.endsWith("/") ? base.pathname : base.pathname + "/";
  const seen = new Set<string>();
  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    let abs: string;
    try {
      abs = new URL(href, hubUrl).toString();
    } catch {
      return;
    }
    const u = new URL(abs);
    if (u.hostname !== base.hostname) return;
    if (!u.pathname.startsWith(hubPrefix)) return;
    abs = abs.split("#")[0];
    if (abs === hubUrl) return;
    if (seen.has(abs)) return;
    seen.add(abs);
    links.push(abs);
  });
  return links.slice(0, 10);
}

function normalizeWebsite(site?: string | null): string | null {
  if (!site) return null;
  let s = site.trim();
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    return new URL(s).toString();
  } catch {
    return null;
  }
}

/**
 * Researches one school: crawls its public site (homepage + staff/
 * leadership/advancement/alumni hub pages, then follows links from those
 * hub pages to individual profile pages where emails usually live),
 * extracts the three required contacts with the AI layer, and either
 * queues them for Zach's verification or - when review mode is off -
 * auto-approves and creates the Gmail draft.
 */
export async function researchSchool(schoolId: string): Promise<void> {
  const school = await prisma.school.findUniqueOrThrow({ where: { id: schoolId } });
  await prisma.school.update({
    where: { id: schoolId },
    data: { status: "RESEARCHING", researchError: null },
  });

  try {
    // Time zone - required by the spec, derived from state with a UI override.
    const tz = school.timeZone ?? timeZoneForState(school.state);
    if (tz) await prisma.school.update({ where: { id: schoolId }, data: { timeZone: tz } });

    let homepage = normalizeWebsite(school.website);
    if (!homepage) {
      const discovered = await findOfficialWebsite(school.name, school.city, school.state);
      homepage = normalizeWebsite(discovered);
      if (homepage) {
        await prisma.school.update({ where: { id: schoolId }, data: { website: homepage } });
      }
    }
    if (!homepage) throw new Error("No website on record and could not find one online - add manually and retry.");

    const homeHtml = await fetchPage(homepage);
    if (!homeHtml) throw new Error(`Could not load ${homepage} (blocked or down).`);

    const pages: { url: string; text: string }[] = [
      { url: homepage, text: pageText(homeHtml) },
    ];
    const hubPages: { url: string; html: string }[] = [];

    for (const link of candidateLinks(homeHtml, homepage)) {
      const html = await fetchPage(link);
      if (html) {
        pages.push({ url: link, text: pageText(html) });
        hubPages.push({ url: link, html });
      }
      if (pages.length >= 7) break;
    }

    // Second pass: follow links from each hub page to individual profile
    // pages, since the email is often published there and not on the
    // listing page itself.
    for (const hub of hubPages) {
      if (pages.length >= 18) break;
      for (const link of profileLinks(hub.html, hub.url)) {
        if (pages.length >= 18) break;
        const html = await fetchPage(link);
        if (html) pages.push({ url: link, text: pageText(html) });
      }
    }

    const found = await extractContacts(school.name, pages);
    if (found.length === 0) throw new Error("No contacts found on the school's site.");

    const autoApprove = !(await reviewModeOn());
    // Replace any previous unapproved research results for a clean retry.
    await prisma.contact.deleteMany({
      where: { schoolId, status: "PENDING_REVIEW" },
    });
    for (const c of found) {
      await prisma.contact.create({
        data: {
          schoolId,
          category: c.category,
          name: c.name,
          title: c.title,
          email: c.email,
          phone: c.phone,
          extension: c.extension,
          sourceUrl: c.sourceUrl,
          confidence: c.confidence,
          status: autoApprove ? "APPROVED" : "PENDING_REVIEW",
        },
      });
    }

    if (autoApprove) {
      await createInitialDraft(schoolId); // sets status DRAFT_CREATED
    } else {
      await prisma.school.update({
        where: { id: schoolId },
        data: { status: "NEEDS_VERIFICATION" },
      });
    }
  } catch (err: any) {
    await prisma.school.update({
      where: { id: schoolId },
      data: { status: "RESEARCH_FAILED", researchError: String(err?.message ?? err) },
    });
  }
}

/** Processes the research queue, oldest first. Called by the worker. */
export async function processResearchQueue(batch = 3): Promise<number> {
  const queued = await prisma.school.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: batch,
  });
  for (const s of queued) await researchSchool(s.id);
  return queued.length;
}
