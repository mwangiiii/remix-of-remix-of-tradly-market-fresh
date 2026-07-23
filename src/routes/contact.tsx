import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, MapPin, Phone, Clock } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { BrowseHeader } from "../marketplace/components/BrowseHeader";
import { contactPageHead } from "../marketplace/lib/seoPages";
import {
  TRADLY_PHONE_E164,
  TRADLY_PHONE_DISPLAY,
  TRADLY_SUPPORT_EMAIL,
  TRADLY_HELLO_EMAIL,
} from "../marketplace/lib/seo";

export const Route = createFileRoute("/contact")({
  head: contactPageHead,
  component: ContactPage,
});

function ContactPage() {
  return (
    <AppShell variant="focused">
      <div className="px-4 pb-16 lg:px-8">
        <div className="lg:hidden">
          <BrowseHeader title="Contact" back="/" />
        </div>

        <header className="hidden pt-10 pb-6 lg:block">
          <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-ink-muted">
            Contact Tradly Market
          </p>
          <h1 className="mt-3 text-[40px] font-semibold leading-[1.05] tracking-tight text-ink">
            Get in touch with Tradly
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink-muted">
            For buyer onboarding, supplier registration, delivery questions, eTIMS invoice queries,
            or anything else — reach the Tradly team directly. Below are the fastest ways to get us.
          </p>
        </header>

        <h1 className="pt-6 text-[22px] font-semibold tracking-tight text-ink lg:hidden">
          Get in touch with Tradly
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-ink-muted lg:hidden">
          Buyer onboarding, supplier registration, delivery, invoices — reach the Tradly team
          directly.
        </p>

        {/* Contact grid. Each card exposes a tel:/mailto: link so mobile
            users tap to call/email — those clicks are also a soft ranking
            signal for local business results ("phone number tapped"). */}
        <section
          className="mt-8 grid gap-3 sm:grid-cols-2"
          aria-labelledby="contact-methods-heading"
        >
          <h2 id="contact-methods-heading" className="sr-only">
            Ways to reach Tradly
          </h2>

          <a
            href={`tel:${TRADLY_PHONE_E164}`}
            className="flex items-start gap-3 rounded-2xl border border-divider bg-surface p-5 transition hover:border-ink/20 lg:p-6"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-farm text-farm-foreground">
              <Phone className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Phone
              </p>
              <p className="mt-1 text-[15px] font-semibold text-ink">{TRADLY_PHONE_DISPLAY}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Order help, delivery status, urgent questions.
              </p>
            </div>
          </a>

          <a
            href={`mailto:${TRADLY_HELLO_EMAIL}`}
            className="flex items-start gap-3 rounded-2xl border border-divider bg-surface p-5 transition hover:border-ink/20 lg:p-6"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-background">
              <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                General
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold text-ink">
                {TRADLY_HELLO_EMAIL}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Partnerships, press, onboarding new buyers or suppliers.
              </p>
            </div>
          </a>

          <a
            href={`mailto:${TRADLY_SUPPORT_EMAIL}`}
            className="flex items-start gap-3 rounded-2xl border border-divider bg-surface p-5 transition hover:border-ink/20 lg:p-6"
          >
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-trust text-trust-foreground">
              <Mail className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Support
              </p>
              <p className="mt-1 truncate text-[15px] font-semibold text-ink">
                {TRADLY_SUPPORT_EMAIL}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Existing-order issues, invoice queries, refunds.
              </p>
            </div>
          </a>

          <div className="flex items-start gap-3 rounded-2xl border border-divider bg-surface p-5 lg:p-6">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-ink-muted">
              <MapPin className="h-4.5 w-4.5" strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-ink-muted">
                Based in
              </p>
              <p className="mt-1 text-[15px] font-semibold text-ink">Nairobi, Kenya</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                Delivering across Nairobi, Kiambu, Machakos, Kirinyaga, Murang'a, Nyeri,
                Nyandarua, Embu, Nakuru, Laikipia and Uasin Gishu.
              </p>
            </div>
          </div>
        </section>

        {/* Opening hours mirror the OpeningHoursSpecification block in
            localBusinessLd() — must stay in sync for Google's local card
            to trust the schema. */}
        <section
          className="mt-6 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="contact-hours-heading"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-muted text-ink-muted">
              <Clock className="h-4 w-4" strokeWidth={1.75} />
            </span>
            <h2
              id="contact-hours-heading"
              className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
            >
              Support hours
            </h2>
          </div>
          <dl className="mt-4 grid gap-2 text-[13.5px] text-ink-muted sm:grid-cols-2 lg:text-[14px]">
            <div className="flex justify-between rounded-xl bg-background px-4 py-2.5">
              <dt className="font-medium text-ink">Monday – Friday</dt>
              <dd className="tabular-nums">07:00 – 19:00</dd>
            </div>
            <div className="flex justify-between rounded-xl bg-background px-4 py-2.5">
              <dt className="font-medium text-ink">Saturday</dt>
              <dd className="tabular-nums">08:00 – 16:00</dd>
            </div>
            <div className="flex justify-between rounded-xl bg-background px-4 py-2.5 sm:col-span-2">
              <dt className="font-medium text-ink">Sunday & public holidays</dt>
              <dd>Order any time — dispatch resumes next business day</dd>
            </div>
          </dl>
          <p className="mt-4 text-[12.5px] leading-relaxed text-ink-muted">
            All times East Africa Time (UTC+3). Orders placed after 3&nbsp;p.m. weekdays or over the
            weekend are dispatched the next business day.
          </p>
        </section>

        <section
          className="mt-6 rounded-3xl border border-divider bg-surface p-6 lg:p-8"
          aria-labelledby="contact-quick-heading"
        >
          <h2
            id="contact-quick-heading"
            className="text-[16px] font-semibold tracking-tight text-ink lg:text-[19px]"
          >
            Before you get in touch
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-ink-muted lg:text-[14.5px]">
            Most delivery, minimum-order, invoicing and payment questions are answered on the FAQ.
            If your query is about an existing order, opening your account page shows the driver ETA
            and the current invoice status directly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              to="/faq"
              className="inline-flex items-center justify-center rounded-full bg-ink px-5 py-2.5 text-[13px] font-semibold text-background"
            >
              Delivery & invoicing FAQ
            </Link>
            <Link
              to="/orders"
              className="inline-flex items-center justify-center rounded-full border border-divider bg-background px-5 py-2.5 text-[13px] font-semibold text-ink"
            >
              Track an existing order
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
