import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import {
  canonicalLink,
  siteUrl,
  jsonLd,
  faqPageLd,
  breadcrumbLd,
  FAQ_ITEMS,
  SITE_NAME,
} from "../marketplace/lib/seo";

const TITLE = `Frequently asked questions — ${SITE_NAME}`;
const DESCRIPTION =
  "Answers about delivery zones, timing, eTIMS invoicing, minimum orders and payment options for Tradly Market — Kenya's single-source produce and pantry supplier.";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: siteUrl("/faq") },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
    ],
    links: [canonicalLink("/faq")],
    scripts: [
      jsonLd(faqPageLd(), "ld-faq"),
      jsonLd(
        breadcrumbLd([
          { name: "Home", path: "/" },
          { name: "FAQ", path: "/faq" },
        ]),
        "ld-faq-breadcrumb",
      ),
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <AppShell variant="focused">
      <div className="px-4 pb-16 lg:px-8">
        <div className="lg:hidden">
          <BrowseHeader title="FAQ" back="/" />
        </div>

        <header className="hidden pt-10 pb-6 lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Help centre
          </p>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-tight text-ink">
            Frequently asked questions
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Delivery zones, timing, invoicing, minimum orders and payment. If your question
            isn't here, message the team from your account page and we'll follow up.
          </p>
        </header>

        <h1 className="pt-6 text-[22px] font-semibold tracking-tight text-ink lg:hidden">
          Frequently asked questions
        </h1>

        {/* The rendered copy must stay identical to FAQ_ITEMS — the FAQPage
            JSON-LD emitted above is derived from the same array, and Google
            demotes FAQ rich results when the two diverge. */}
        <div className="mt-4 divide-y divide-divider rounded-2xl border border-divider bg-surface lg:mt-6">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group px-5 py-4 lg:px-6 lg:py-5"
              // The first item is opened by default so buyers land on a
              // populated card, not a stack of closed rows.
              open={item === FAQ_ITEMS[0] ? true : undefined}
            >
              <summary className="flex cursor-pointer items-center justify-between gap-4 text-[14px] font-semibold text-ink marker:content-none lg:text-[16px]">
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-divider text-ink-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
                {item.a}
              </p>
            </details>
          ))}
        </div>

        <section
          className="mt-10 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="faq-cta-heading"
        >
          <p
            id="faq-cta-heading"
            className="text-[14px] font-semibold text-ink lg:text-[17px]"
          >
            Still stuck?
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted lg:text-[14px]">
            The Tradly team is on WhatsApp during business hours. Sign in and open your
            account page for the direct line, or start browsing the market.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-background"
            >
              Browse the market
            </Link>
            <Link
              to="/account"
              className="inline-flex items-center justify-center rounded-full border border-divider bg-background px-5 py-2.5 text-[13px] font-semibold text-ink"
            >
              Open account
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
