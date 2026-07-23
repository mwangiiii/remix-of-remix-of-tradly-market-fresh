// Per-page SEO scaffolding for the About, How-It-Works, and Contact routes.
//
// These are the SEO ingredients ONLY — no UI. Each export returns exactly the
// shape TanStack Start's `head()` expects (meta / links / scripts), so when
// someone builds the actual page component they wire the SEO with one line:
//
//   import { aboutPageHead } from "@/marketplace/lib/seoPages";
//   export const Route = createFileRoute("/about")({
//     head: aboutPageHead,
//     component: AboutPage,   // ← the UI, still to be built
//   });
//
// The three canonical URLs (/about, /how-it-works, /contact) do NOT yet have
// route files — this file is inert until the UI ships. Do not add these URLs
// to the sitemap route until then, or Googlebot will hit 404s.
//
// FAQ pairs on each page must be rendered visibly in the UI (as <details> or
// an accordion). Google + LLMs only trust FAQPage schema when the same Q/A
// text is in the rendered HTML.

import {
  canonicalLink,
  siteUrl,
  jsonLd,
  breadcrumbLd,
  serviceLd,
  FAQ_ITEMS,
} from "./seo";

// ─────────────────────────────────────────────────────────────────────────
// Shared shape — matches TanStack Start's head() return type. Kept loose
// (Array<...>) so callers don't need to import router types here.
// ─────────────────────────────────────────────────────────────────────────
type HeadFactory = () => {
  meta: Array<Record<string, string>>;
  links: Array<Record<string, string>>;
  scripts: Array<{ type: string; children: string }>;
};

// Small helper — every page shares the same OG/Twitter tag set, so we build
// them once per (title, description, path) tuple instead of copy-pasting.
function socialMeta(
  title: string,
  description: string,
  path: string,
): Array<Record<string, string>> {
  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: siteUrl(path) },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ];
}

// ─────────────────────────────────────────────────────────────────────────
// /about
//
// AboutPage schema anchors the page as the "about this organisation" node.
// Because our global Organization node already lives on __root, we DON'T
// re-emit it here — mainEntity references it by @id instead, which is the
// canonical way to attach an About page to an existing entity.
// ─────────────────────────────────────────────────────────────────────────
const ABOUT_TITLE = `About Tradly Market — Kenya's single-source B2B pantry supplier`;
const ABOUT_DESCRIPTION =
  "Tradly Market removes broker layers between Kenyan farms and institutional kitchens — hotels, restaurants, hospitals, schools and offices — with same-day dispatch and eTIMS-compliant invoicing.";

const ABOUT_KEYWORDS = [
  "about Tradly",
  "Tradly Kenya",
  "what is Tradly",
  "Tradly Market Nairobi",
  "B2B produce supplier Kenya",
];

export const aboutPageHead: HeadFactory = () => ({
  meta: [
    ...socialMeta(ABOUT_TITLE, ABOUT_DESCRIPTION, "/about"),
    { name: "keywords", content: ABOUT_KEYWORDS.join(", ") },
  ],
  links: [canonicalLink("/about")],
  scripts: [
    jsonLd(
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        "@id": `${siteUrl("/about")}#aboutpage`,
        url: siteUrl("/about"),
        name: ABOUT_TITLE,
        description: ABOUT_DESCRIPTION,
        // Reference the Organization node emitted on the root — @id linkage
        // keeps a single entity across the graph instead of a duplicate node.
        mainEntity: { "@id": `${siteUrl("/")}#organization` },
        isPartOf: { "@id": `${siteUrl("/")}#website` },
        inLanguage: "en-KE",
      },
      "ld-about",
    ),
    jsonLd(
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "About", path: "/about" },
      ]),
      "ld-about-breadcrumb",
    ),
  ],
});

// ─────────────────────────────────────────────────────────────────────────
// /how-it-works
//
// Pairs a Service node (describing what Tradly offers) with a HowTo node
// (step-by-step: order → dispatch → delivery → invoice → payment). HowTo
// used to trigger a rich result but no longer does on desktop — kept
// anyway because LLMs still lift the sequence when answering procedural
// questions ("how does Tradly work?").
// ─────────────────────────────────────────────────────────────────────────
const HIW_TITLE = `How Tradly Market works — order to compliant invoice`;
const HIW_DESCRIPTION =
  "See how Tradly runs procurement end-to-end: order fresh produce, get same-day dispatch across Nairobi, and receive a KRA eTIMS-compliant invoice on delivery.";

const HIW_KEYWORDS = [
  "how Tradly works",
  "procurement software for restaurants Kenya",
  "procure to pay software Kenya",
  "supplier price comparison Kenya",
  "purchase order software Kenya",
  "eTIMS compliant procurement software Kenya",
];

// Steps 1-5 mirror the procure-to-pay flow that already exists in the app
// (cart → order → dispatch → delivery → invoice). Keep in sync if the UX
// changes — inconsistent HowTo vs on-page copy is worse than none.
const HIW_STEPS = [
  {
    name: "Browse and add to cart",
    text: "Browse today's fresh picks by category or search across the full Tradly catalogue, then add items and pack sizes to your cart.",
  },
  {
    name: "Place your order",
    text: "Checkout on account (business buyers) or with Paystack/M-Pesa. Orders placed before 3 p.m. are dispatched the same day within Nairobi.",
  },
  {
    name: "Receive same-day dispatch",
    text: "Tradly aggregates from source overnight so your order leaves the depot the day you place it and typically lands the same evening in Nairobi.",
  },
  {
    name: "Confirm delivery",
    text: "The driver confirms delivery in-app and the order is three-way matched (purchase request → delivery → invoice) before payment is captured.",
  },
  {
    name: "Get your eTIMS invoice",
    text: "Every order is invoiced through Tradly Finance with a KRA eTIMS-compliant tax invoice, so your procurement stays VAT-clean and audit-ready.",
  },
];

// A subset of FAQ_ITEMS most relevant to how-it-works (delivery timing,
// eTIMS, payment). Pulled by matching first words rather than duplicating.
const HIW_FAQS = FAQ_ITEMS.filter((f) => /^(How fast|Do I get|How do I pay)/.test(f.q));

export const howItWorksPageHead: HeadFactory = () => ({
  meta: [
    ...socialMeta(HIW_TITLE, HIW_DESCRIPTION, "/how-it-works"),
    { name: "keywords", content: HIW_KEYWORDS.join(", ") },
  ],
  links: [canonicalLink("/how-it-works")],
  scripts: [
    jsonLd(
      serviceLd({
        name: "Tradly Market — B2B procurement and same-day supply",
        description: HIW_DESCRIPTION,
        path: "/how-it-works",
        serviceType: "B2B procurement and produce supply",
      }),
      "ld-hiw-service",
    ),
    jsonLd(
      {
        "@context": "https://schema.org",
        "@type": "HowTo",
        "@id": `${siteUrl("/how-it-works")}#howto`,
        name: "How to order fresh produce and pantry supplies from Tradly Market",
        description: HIW_DESCRIPTION,
        totalTime: "PT5M",
        step: HIW_STEPS.map((s, i) => ({
          "@type": "HowToStep",
          position: i + 1,
          name: s.name,
          text: s.text,
        })),
      },
      "ld-hiw-howto",
    ),
    jsonLd(
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        "@id": `${siteUrl("/how-it-works")}#faq`,
        mainEntity: HIW_FAQS.map(({ q, a }) => ({
          "@type": "Question",
          name: q,
          acceptedAnswer: { "@type": "Answer", text: a },
        })),
      },
      "ld-hiw-faq",
    ),
    jsonLd(
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "How it works", path: "/how-it-works" },
      ]),
      "ld-hiw-breadcrumb",
    ),
  ],
});

// Re-export the steps + FAQ subset so the UI page can render them from the
// same source of truth (schema must match visible copy, per Google guidance).
export const HOW_IT_WORKS_STEPS = HIW_STEPS;
export const HOW_IT_WORKS_FAQS = HIW_FAQS;

// ─────────────────────────────────────────────────────────────────────────
// /contact
//
// ContactPage + a ContactPoint the org already exposes globally. Also
// emits a small local reference to the Nairobi hub via mainEntity → the
// LocalBusiness @id — so a Google search for "Tradly contact" can surface
// the map card without duplicating address data.
// ─────────────────────────────────────────────────────────────────────────
const CONTACT_TITLE = `Contact Tradly Market — Nairobi, Kenya`;
const CONTACT_DESCRIPTION =
  "Get in touch with Tradly Market. Email hello@tradly.co.ke for buyer onboarding, supplier registration, delivery questions, or eTIMS invoice queries in Kenya.";

const CONTACT_KEYWORDS = [
  "contact Tradly",
  "Tradly support",
  "Tradly Market Nairobi contact",
  "Tradly email",
  "Tradly delivery contact Kenya",
];

export const contactPageHead: HeadFactory = () => ({
  meta: [
    ...socialMeta(CONTACT_TITLE, CONTACT_DESCRIPTION, "/contact"),
    { name: "keywords", content: CONTACT_KEYWORDS.join(", ") },
  ],
  links: [canonicalLink("/contact")],
  scripts: [
    jsonLd(
      {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        "@id": `${siteUrl("/contact")}#contactpage`,
        url: siteUrl("/contact"),
        name: CONTACT_TITLE,
        description: CONTACT_DESCRIPTION,
        isPartOf: { "@id": `${siteUrl("/")}#website` },
        // mainEntity links the ContactPage to the LocalBusiness so Google
        // surfaces the map / opening hours card when someone searches
        // "Tradly contact" — no duplicate address data needed.
        mainEntity: { "@id": `${siteUrl("/")}#localbusiness` },
        inLanguage: "en-KE",
      },
      "ld-contact",
    ),
    jsonLd(
      breadcrumbLd([
        { name: "Home", path: "/" },
        { name: "Contact", path: "/contact" },
      ]),
      "ld-contact-breadcrumb",
    ),
  ],
});
