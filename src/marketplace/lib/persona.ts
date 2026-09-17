// Household Commerce spec v1.0 §18 item 20 — persona-aware copy.
//
// One storefront serves both households and companies. Anon browsers see
// the current copy (unchanged — Google indexes on it, so a swap would
// erase existing SEO). Signed-in individuals see household-flavoured
// wording; signed-in companies see procurement-flavoured wording. The
// swap happens client-side after AuthProvider's silent refresh settles.
//
// SSR safety: useBuyerPersona() returns 'anon' during isInitializing so
// server + first client paint agree. React hydration doesn't complain.
// The persona flip happens on the next render after the JWT restores.
//
// Design note: FAQ + delivery-zones copy stays anon-flavoured everywhere
// because those are load-bearing SEO surfaces (JSON-LD schema, long-tail
// keywords). Only home hero + about coverage + contact blurb + /account
// header swap. Small pass, meaningful in feel.

import { useAuth } from "@/hooks/use-auth";

export type Persona = "anon" | "individual" | "company";

/** Returns the buyer's persona for copy branching. */
export function useBuyerPersona(): Persona {
  const { isAuthenticated, isInitializing, buyer } = useAuth();
  // Server always renders 'anon' (no JWT). isInitializing covers the
  // brief moment after mount before the silent refresh resolves.
  if (isInitializing || !isAuthenticated || !buyer) return "anon";
  if (buyer.businessType === "company") return "company";
  if (buyer.businessType === "individual") return "individual";
  return "anon";
}

export interface HomeHeroCopy {
  eyebrow: string;
  headline: string;
  subhead: string;
}

export interface AccountHeaderCopy {
  signedInLabel: string;
  businessSectionTitle: string;
}

export interface PersonaCopy {
  homeHero: HomeHeroCopy;
  whereWeDeliverIntro: string;
  aboutCoverageIntro: string;
  contactBlurb: string;
  account: AccountHeaderCopy;
}

// ─── The three variants ──────────────────────────────────────────────────

const ANON: PersonaCopy = {
  homeHero: {
    eyebrow: "Tradly Market · Nairobi",
    headline: "Fresh produce.",
    // The current split-across-two-lines pattern is preserved here as a
    // raw string; the home component decides whether to visually split.
    subhead:
      "Vegetables, fruit, rice and pantry staples, curated by Tradly and delivered same day across Kenyan kitchens.",
  },
  whereWeDeliverIntro:
    "Tradly Market delivers across Nairobi — same-day to households and institutions in the eight zones below. Coverage expands as we add rider routes; if you're outside a zone, checkout offers courier pickup and self-collect.",
  aboutCoverageIntro:
    "Orders placed before the zone cutoff (12–2 p.m. depending on distance from the hub) are dispatched the same day and typically delivered by end of day. Orders after cutoff land the next available day. Coverage today: eight zones across Nairobi. Customers outside a zone can arrange courier pickup or self-collect at checkout.",
  contactBlurb:
    "Delivering across Nairobi. Courier pickup and self-collect available anywhere in Kenya at checkout.",
  account: {
    signedInLabel: "Signed in as",
    businessSectionTitle: "Business",
  },
};

const INDIVIDUAL: PersonaCopy = {
  homeHero: {
    eyebrow: "Tradly Home · Nairobi",
    headline: "Don't go to the market.",
    subhead:
      "Order fresh produce and pantry staples for your kitchen — same-day rider to your door across Nairobi, one supplier you can trust.",
  },
  whereWeDeliverIntro:
    "Same-day delivery to your door in the eight Nairobi zones below. Not in a zone? Pick self-collect or arrange your own courier at checkout — everywhere in Kenya works.",
  aboutCoverageIntro:
    "We deliver to your door across eight Nairobi zones. Cutoff varies by distance from the hub (12–2 p.m.) — order before cutoff for same-day; after that lands next day. Outside a zone? Choose courier pickup or self-collect at checkout.",
  contactBlurb:
    "Delivering to your door across Nairobi. Anywhere in Kenya via courier pickup or self-collect at checkout.",
  account: {
    signedInLabel: "Your household",
    businessSectionTitle: "Household details",
  },
};

const COMPANY: PersonaCopy = {
  homeHero: {
    eyebrow: "Tradly Business · Nairobi",
    headline: "Procurement without paperwork.",
    subhead:
      "One supplier, one invoice, one eTIMS filing. Fresh produce and kitchen essentials for restaurants, hotels, schools and offices — same day across Nairobi.",
  },
  whereWeDeliverIntro:
    "Same-day delivery for restaurants, hotels, schools and offices across the eight Nairobi zones below. Add branches for split deliveries; one PO covers them all.",
  aboutCoverageIntro:
    "Orders placed before the zone cutoff are dispatched same-day and typically delivered by end of day. Coverage today: eight zones across Nairobi. Larger institutions with multiple branches settle everything on a single monthly invoice.",
  contactBlurb:
    "Delivering across Nairobi to restaurants, hotels, schools, hospitals and corporate offices. Monthly invoicing, eTIMS-compliant on every line.",
  account: {
    signedInLabel: "Signed in as",
    businessSectionTitle: "Business",
  },
};

// ─── Public map ──────────────────────────────────────────────────────────

export const COPY: Record<Persona, PersonaCopy> = {
  anon: ANON,
  individual: INDIVIDUAL,
  company: COMPANY,
};

/** Convenience — the current buyer's copy set. */
export function usePersonaCopy(): PersonaCopy {
  return COPY[useBuyerPersona()];
}
