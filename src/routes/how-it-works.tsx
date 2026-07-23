import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import {
  howItWorksPageHead,
  HOW_IT_WORKS_STEPS,
  HOW_IT_WORKS_FAQS,
} from "../marketplace/lib/seoPages";

export const Route = createFileRoute("/how-it-works")({
  head: howItWorksPageHead,
  component: HowItWorksPage,
});

function HowItWorksPage() {
  return (
    <AppShell variant="focused">
      <div className="px-4 pb-16 lg:px-8">
        <div className="lg:hidden">
          <BrowseHeader title="How it works" back="/" />
        </div>

        <header className="hidden pt-10 pb-6 lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            How Tradly Market works
          </p>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-tight text-ink">
            From order to compliant invoice, in five steps
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Tradly is a B2B procurement platform for Kenyan hotels, restaurants, hospitals, schools
            and offices. Here's the procure-to-pay flow every order runs through — from browsing
            today's fresh picks to receiving a KRA eTIMS-compliant invoice on delivery.
          </p>
        </header>

        <h1 className="pt-6 text-[22px] font-semibold tracking-tight text-ink lg:hidden">
          How Tradly works — order to invoice
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:hidden">
          The five-step procure-to-pay flow, from browsing today's fresh picks to a KRA
          eTIMS-compliant invoice on delivery.
        </p>

        {/* The visible step list is rendered from HOW_IT_WORKS_STEPS — the
            same array feeds the HowTo JSON-LD. Keeping schema and visible
            copy in exact sync is a Google guideline; drift demotes the rich
            result. Do not edit copy here without updating seoPages.ts too. */}
        <ol className="mt-6 space-y-3 lg:mt-8">
          {HOW_IT_WORKS_STEPS.map((step, i) => (
            <li
              key={step.name}
              className="flex gap-4 rounded-2xl border border-divider bg-surface p-5 lg:p-6"
            >
              <span
                aria-hidden="true"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-farm text-[15px] font-bold text-farm-foreground lg:h-10 lg:w-10 lg:text-[16px]"
              >
                {i + 1}
              </span>
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-ink lg:text-[17px]">{step.name}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
                  {step.text}
                </p>
              </div>
            </li>
          ))}
        </ol>

        <section
          className="mt-10 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="hiw-why-heading"
        >
          <h2
            id="hiw-why-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            Why buyers move to Tradly
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:text-[15px]">
            Traditional procurement in Kenya's hospitality, healthcare and institutional sectors
            runs on WhatsApp orders, spreadsheets and three-broker supply chains. That means
            unpredictable prices, no audit trail, and invoices that don't line up with what actually
            got delivered.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:text-[15px]">
            Tradly replaces that with a single procurement platform: transparent farm-direct
            pricing, three-way matching between the purchase request, delivery and invoice, and a
            KRA eTIMS-compliant tax invoice generated automatically. Finance teams stop chasing
            paper; kitchens stop chasing brokers.
          </p>
        </section>

        <section
          className="mt-6 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="hiw-compare-heading"
        >
          <h2
            id="hiw-compare-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            Broker chain vs Tradly
          </h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-[13.5px] text-ink-muted lg:text-[14px]">
              <thead>
                <tr className="border-b border-divider text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
                  <th className="pb-2 pr-4">What you get</th>
                  <th className="pb-2 pr-4">Broker chain</th>
                  <th className="pb-2">Tradly Market</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                <tr>
                  <td className="py-3 pr-4 font-medium text-ink">Pricing</td>
                  <td className="py-3 pr-4">3–4 layers of markup</td>
                  <td className="py-3">Farm-adjacent, transparent</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-ink">Invoicing</td>
                  <td className="py-3 pr-4">Hand-written / non-compliant</td>
                  <td className="py-3">KRA eTIMS on every order</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-ink">Dispatch</td>
                  <td className="py-3 pr-4">Ad-hoc, unpredictable</td>
                  <td className="py-3">Same-day across Nairobi</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-ink">Audit trail</td>
                  <td className="py-3 pr-4">WhatsApp screenshots</td>
                  <td className="py-3">Order → delivery → invoice, matched</td>
                </tr>
                <tr>
                  <td className="py-3 pr-4 font-medium text-ink">Reordering</td>
                  <td className="py-3 pr-4">Rebuild the list each week</td>
                  <td className="py-3">Saved lists, one-tap reorder</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Visible FAQ block — copy must match HOW_IT_WORKS_FAQS 1:1 because
            the FAQPage JSON-LD is generated from that same array. */}
        <section className="mt-10" aria-labelledby="hiw-faq-heading">
          <h2
            id="hiw-faq-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            Common questions
          </h2>
          <div className="mt-4 divide-y divide-divider rounded-2xl border border-divider bg-surface">
            {HOW_IT_WORKS_FAQS.map((item, i) => (
              <details
                key={item.q}
                className="group px-5 py-4 lg:px-6 lg:py-5"
                open={i === 0 ? true : undefined}
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
          <p className="mt-3 text-[12.5px] text-ink-muted">
            More answers in the{" "}
            <Link to="/faq" className="font-semibold text-ink underline">
              full FAQ
            </Link>
            .
          </p>
        </section>

        <section
          className="mt-10 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="hiw-cta-heading"
        >
          <p id="hiw-cta-heading" className="text-[14px] font-semibold text-ink lg:text-[17px]">
            Ready to place your first order?
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted lg:text-[14px]">
            Browse today's fresh picks and check out on account or with M-Pesa. Your first eTIMS
            invoice arrives with the delivery.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-background"
            >
              Browse the market
            </Link>
            <Link
              to="/about"
              className="inline-flex items-center justify-center rounded-full border border-divider bg-background px-5 py-2.5 text-[13px] font-semibold text-ink"
            >
              About Tradly
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
