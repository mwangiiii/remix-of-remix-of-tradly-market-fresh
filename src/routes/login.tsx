import { trackEvent } from "@/lib/analytics";
import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Mail } from "lucide-react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useAuth } from "@/hooks/use-auth";

const searchSchema = z.object({ next: z.string().optional() });

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Tradly Market" },
      { name: "description", content: "Sign in to Tradly Market to place orders and track deliveries." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Sign in — Tradly Market" },
      { property: "og:description", content: "Sign in to your Tradly Market buyer account." },
      { property: "og:url", content: "https://market.tradly.co.ke/login" },
    ],
  }),
  validateSearch: searchSchema,
  component: Login,
});

// Auth channel:
//   email      → email + password (existing company workspace sign-in)
//   signup     → email + password + company_name (creates a company workspace)
//   magic      → magic-link email → provisions an individual workspace (spec §8)
type Channel = "email" | "signup" | "magic";

function Login() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/login" });
  const {
    login, signup, sendMagicLink,
    isLoading, isAuthenticated, isInitializing, error,
  } = useAuth();

  const [channel, setChannel] = useState<Channel>("email");

  // Email / signup fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");

  // Magic-link fields (own state so switching channels doesn't leak)
  const [magicEmail, setMagicEmail] = useState("");
  const [magicName, setMagicName] = useState("");
  const [magicSent, setMagicSent] = useState(false);

  // Session already restored → get out of the way.
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate({ to: next ?? "/account" });
    }
  }, [isInitializing, isAuthenticated, navigate, next]);

  // ─── Handlers ────────────────────────────────────────────────────────

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (channel === "signup") {
        await signup({
          email: email.trim(),
          password,
          companyName: companyName.trim(),
          phone: phone.trim() || undefined,
        });
        toast.success("Workspace ready");
        // Only on the signup branch — logging in is not a signup completion.
        trackEvent("market_signup_completed", { method: "email" });
      } else {
        await login(email.trim(), password);
        toast.success("Welcome back");
      }
      navigate({ to: next ?? "/account" });
    } catch { /* error already surfaced via context */ }
  };

  const submitMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = magicEmail.trim();
    const trimmedName  = magicName.trim();
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }
    if (trimmedName.length < 2) {
      toast.error("Enter your name so we can label your account");
      return;
    }
    try {
      await sendMagicLink(trimmedEmail, trimmedName);
      setMagicSent(true);
    } catch { /* error already surfaced */ }
  };

  const changeChannel = (c: Channel) => {
    setChannel(c);
    if (c !== "magic") setMagicSent(false);
  };

  return (
    <AppShell hideNav>
      <div className="px-4">
        <TrustHeader
          title={
            channel === "magic"
              ? (magicSent ? "Check your email" : "Sign in with email link")
              : channel === "signup"
                ? "Create workspace"
                : "Sign in"
          }
          back="/"
        />

        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold text-ink">Tradly Market</h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            {channel === "magic"
              ? "One-click sign-in — we email you a secure link, no password needed."
              : channel === "signup"
                ? "Set up a company workspace to order."
                : "Sign in to your company workspace."}
          </p>
        </div>

        {/* Channel toggle chips */}
        <div className="mt-5 flex justify-center gap-1.5" role="tablist">
          {(["email", "magic", "signup"] as Channel[]).map((c) => {
            const isActive = channel === c;
            const label = c === "email" ? "Password" : c === "magic" ? "Email link" : "New workspace";
            return (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => changeChannel(c)}
                className={
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition-colors " +
                  (isActive
                    ? "border-trust bg-trust text-trust-foreground"
                    : "border-divider bg-surface text-ink-muted hover:bg-divider/40")
                }
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* ── Email / Signup form ──────────────────────────────────────── */}
        {(channel === "email" || channel === "signup") && (
          <form onSubmit={submitEmail} className="mt-6 space-y-3">
            {channel === "signup" && (
              <Field
                label="Company name"
                value={companyName}
                onChange={setCompanyName}
                autoComplete="organization"
                required
              />
            )}
            <Field
              label="Work email"
              value={email}
              onChange={setEmail}
              inputMode="email"
              type="email"
              autoComplete="email"
              required
            />
            <Field
              label="Password"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete={channel === "signup" ? "new-password" : "current-password"}
              required
            />
            {channel === "signup" && (
              <>
                <Field
                  label="Phone (optional)"
                  value={phone}
                  onChange={setPhone}
                  inputMode="tel"
                  autoComplete="tel"
                />
                <p className="rounded-xl border border-divider bg-surface px-3 py-3 text-[12px] text-ink-muted">
                  You can add a KRA PIN later — we'll ask before your first eTIMS invoice.
                </p>
              </>
            )}

            {error && <ErrorBox message={error.message} />}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm disabled:opacity-60"
            >
              {isLoading
                ? "Please wait…"
                : channel === "signup" ? "Create workspace" : "Sign in"}
            </button>
          </form>
        )}

        {/* ── Magic-link form ──────────────────────────────────────────── */}
        {channel === "magic" && !magicSent && (
          <form onSubmit={submitMagicLink} className="mt-6 space-y-3">
            <Field
              label="Email"
              value={magicEmail}
              onChange={setMagicEmail}
              inputMode="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
            <Field
              label="Your name"
              value={magicName}
              onChange={setMagicName}
              autoComplete="name"
              required
              placeholder="e.g. Grace Muthoni"
            />
            <p className="rounded-xl border border-divider bg-surface px-3 py-3 text-[12px] text-ink-muted">
              We'll email you a link — click it to sign in. New here? We'll set up your individual account.
            </p>

            {error && <ErrorBox message={error.message} />}

            <button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm disabled:opacity-60"
            >
              {isLoading ? "Sending…" : (<><Mail className="mr-2 inline h-4 w-4" aria-hidden />Email me the link</>)}
            </button>
          </form>
        )}

        {channel === "magic" && magicSent && (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-trust/30 bg-trust/[0.04] p-5 flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-trust/15 text-trust">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold text-ink">Check your email</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                  We sent a sign-in link to{" "}
                  <span className="font-semibold text-ink">{magicEmail}</span>.
                  Click it from any device — you'll be signed in automatically.
                </p>
                <p className="mt-2 text-[11.5px] text-ink-muted">
                  The link expires in 60 minutes. Didn't get it?{" "}
                  <button
                    type="button"
                    onClick={submitMagicLink}
                    className="font-semibold text-trust"
                  >
                    Resend
                  </button>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setMagicSent(false); }}
              className="w-full text-center text-[12.5px] text-ink-muted hover:text-ink"
            >
              Use a different email
            </button>
          </div>
        )}

        <p className="mt-6 text-center text-[12px] text-ink-muted">
          <Link to="/" className="hover:text-ink">Continue browsing anonymously</Link>
        </p>
      </div>
    </AppShell>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-[12.5px] text-red-700">
      {message}
    </p>
  );
}

function Field({
  label, value, onChange, inputMode, type = "text",
  autoComplete, required, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "text" | "tel" | "email";
  type?: string;
  autoComplete?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-muted">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        type={type}
        autoComplete={autoComplete}
        required={required}
        placeholder={placeholder}
        className="mt-1 w-full rounded-xl border border-divider bg-surface px-3 py-3 text-[14px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
      />
    </label>
  );
}
