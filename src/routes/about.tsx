import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { aboutPageHead } from "../marketplace/lib/seoPages";

export const Route = createFileRoute("/about")({
  head: aboutPageHead,
  component: AboutPage,
});

function AboutPage() {
  return (
    <AppShell variant="focused">
      <div className="px-4 pb-16 lg:px-8">
        <div className="lg:hidden">
          <BrowseHeader title="About" back="/" />
        </div>

        <header className="hidden pt-10 pb-6 lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            About Tradly Market
          </p>
          {/* H1 leads with the primary target phrase verbatim — Google needs
              this literal string on the page to consider ranking us for it. */}
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-tight text-ink">
            Kenya's B2B agri procurement marketplace
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            Tradly Market is a B2B procurement marketplace for hotels, restaurants, hospitals,
            schools and offices across Kenya — a single-source route to farm-fresh produce, dairy,
            rice and pantry staples with same-day dispatch and KRA eTIMS-compliant invoicing.
          </p>
        </header>

        <h1 className="pt-6 text-[22px] font-semibold tracking-tight text-ink lg:hidden">
          Kenya's B2B agri procurement marketplace
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:hidden">
          Tradly Market is a B2B procurement marketplace for hotels, restaurants, hospitals, schools
          and offices across Kenya. Same-day dispatch, farm-direct pricing, KRA eTIMS-compliant
          invoicing.
        </p>

        {/* Definition block — deliberately quotable, one-sentence facts.
            LLM answer engines lift these sentences verbatim into responses. */}
        <section
          className="mt-8 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="about-what-heading"
        >
          <h2
            id="about-what-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            What Tradly Market is
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:text-[15px]">
            Tradly is a Kenyan agri market platform that connects institutional buyers directly with
            farmers, aggregators and vetted distributors. Instead of chaining orders through three
            or four broker layers, buyers place a single order on Tradly and get one delivery, one
            KRA-compliant invoice, and one place to reorder.
          </p>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:text-[15px]">
            Behind the storefront sits Tradly's full procure-to-pay platform — purchase requests,
            price comparison, three-way matching, and eTIMS invoicing — the same procurement stack
            larger businesses run, packaged for kitchens and offices that don't want to run it
            themselves.
          </p>
        </section>

        <section
          className="mt-6 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="about-who-heading"
        >
          <h2
            id="about-who-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            Who buys on Tradly
          </h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-muted lg:text-[15px]">
            <li>
              <strong className="font-semibold text-ink">
                Hotels, restaurants, bars and cafés
              </strong>{" "}
              — daily fresh produce and pantry orders with consistent quality and pricing that a
              head chef can actually plan around.
            </li>
            <li>
              <strong className="font-semibold text-ink">
                Hospitals and healthcare facilities
              </strong>{" "}
              — vetted, traceable produce for hospital kitchens with the paper trail procurement
              needs.
            </li>
            <li>
              <strong className="font-semibold text-ink">
                Boarding schools, colleges and universities
              </strong>{" "}
              — bulk institutional supply with term-time predictability.
            </li>
            <li>
              <strong className="font-semibold text-ink">Caterers and event kitchens</strong> —
              flex-volume orders with delivery timed to the event.
            </li>
            <li>
              <strong className="font-semibold text-ink">
                Corporate offices and facilities teams
              </strong>{" "}
              — office pantry, staff-welfare fruit, and cleaning consumables on one bill.
            </li>
          </ul>
        </section>

        <section
          className="mt-6 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="about-diff-heading"
        >
          <h2
            id="about-diff-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            How Tradly is different
          </h2>
          <dl className="mt-3 space-y-4">
            <div>
              <dt className="text-[14px] font-semibold text-ink lg:text-[15px]">
                Direct from farm, no broker layer
              </dt>
              <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
                Tradly aggregates from farms and vetted suppliers overnight so buyers pay
                farm-adjacent prices and farmers earn more per kilo. No middleman markup between the
                farm gate and the kitchen door.
              </dd>
            </div>
            <div>
              <dt className="text-[14px] font-semibold text-ink lg:text-[15px]">
                Compliance built in
              </dt>
              <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
                Every invoice is KRA eTIMS-compliant. Procurement stays VAT-clean and audit-ready
                without buyer effort.
              </dd>
            </div>
            <div>
              <dt className="text-[14px] font-semibold text-ink lg:text-[15px]">
                Same-day dispatch across Nairobi
              </dt>
              <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
                Orders placed before 3&nbsp;p.m. are dispatched the same day and typically land
                the same evening across Nairobi County. Kiambu and near Machakos land next day.
                Kirinyaga, Murang'a, Nyeri, Nyandarua and Embu land within one to two days.
                Nakuru county (Nakuru, Naivasha, Gilgil, Elburgon, Subukia), Laikipia (Nanyuki,
                Nyahururu) and Uasin Gishu (Eldoret) land within two to three days depending on
                distance from the Nairobi depot.
              </dd>
            </div>
            <div>
              <dt className="text-[14px] font-semibold text-ink lg:text-[15px]">
                Real supply-chain visibility
              </dt>
              <dd className="mt-1 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
                Orders are tracked from purchase request through delivery, goods-received note,
                invoice and payment — the same procure-to-pay flow larger businesses use, in a form
                SMEs can adopt in a day.
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="mt-6 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="about-facts-heading"
        >
          <h2
            id="about-facts-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            Key facts
          </h2>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-divider bg-background p-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Based in
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">Nairobi, Kenya</dd>
            </div>
            <div className="rounded-2xl border border-divider bg-background p-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Coverage
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                Nairobi, Kiambu, Machakos, Kirinyaga, Murang'a, Nyeri, Nyandarua, Embu, Nakuru,
                Laikipia, Uasin Gishu
              </dd>
            </div>
            <div className="rounded-2xl border border-divider bg-background p-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Payment
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                M-Pesa, bank transfer, Paystack
              </dd>
            </div>
            <div className="rounded-2xl border border-divider bg-background p-4">
              <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Invoicing
              </dt>
              <dd className="mt-1 text-[14px] font-semibold text-ink">
                KRA eTIMS-compliant on every order
              </dd>
            </div>
          </dl>
        </section>

        <section
          className="mt-10 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="about-cta-heading"
        >
          <p id="about-cta-heading" className="text-[14px] font-semibold text-ink lg:text-[17px]">
            Ready to try Tradly?
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-muted lg:text-[14px]">
            Browse today's fresh picks, see how the procure-to-pay flow works, or check the answers
            to the most common delivery and invoicing questions.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-background"
            >
              Browse the market
            </Link>
            <Link
              to="/how-it-works"
              className="inline-flex items-center justify-center rounded-full border border-divider bg-background px-5 py-2.5 text-[13px] font-semibold text-ink"
            >
              How it works
            </Link>
            <Link
              to="/faq"
              className="inline-flex items-center justify-center rounded-full border border-divider bg-background px-5 py-2.5 text-[13px] font-semibold text-ink"
            >
              Delivery & invoicing FAQ
            </Link>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
