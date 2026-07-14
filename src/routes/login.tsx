import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
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

function Login() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/login" });
  const { login, signup, isLoading, isAuthenticated, isInitializing, error } = useAuth();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");

  // If a silent-refresh restores a session, get out of the way.
  useEffect(() => {
    if (!isInitializing && isAuthenticated) {
      navigate({ to: next ?? "/account" });
    }
  }, [isInitializing, isAuthenticated, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "signup") {
        await signup({
          email: email.trim(),
          password,
          companyName: companyName.trim(),
          phone: phone.trim() || undefined,
        });
        toast.success("Workspace ready");
      } else {
        await login(email.trim(), password);
        toast.success("Welcome back");
      }
      navigate({ to: next ?? "/account" });
    } catch {
      // AuthProvider sets `error` — surfaced below.
    }
  };

  return (
    <AppShell hideNav>
      <div className="px-4">
        <TrustHeader title={mode === "signin" ? "Sign in" : "Create workspace"} back="/" />

        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold text-ink">Tradly Market</h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            {mode === "signin"
              ? "Sign in to your company workspace."
              : "Set up a company workspace to order."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-3">
          {mode === "signup" && (
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
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
          />

          {mode === "signup" && (
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

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-3 text-[12.5px] text-red-700">
              {error.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm disabled:opacity-60"
          >
            {isLoading
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create workspace"}
          </button>
        </form>

        <p className="mt-6 text-center text-[13px] text-ink-muted">
          {mode === "signin" ? "New to Tradly? " : "Already have a workspace? "}
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-trust"
          >
            {mode === "signin" ? "Create workspace" : "Sign in"}
          </button>
        </p>

        <p className="mt-4 text-center text-[12px] text-ink-muted">
          <Link to="/" className="hover:text-ink">Continue browsing anonymously</Link>
        </p>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
  type = "text",
  autoComplete,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "text" | "tel" | "email";
  type?: string;
  autoComplete?: string;
  required?: boolean;
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
        className="mt-1 w-full rounded-xl border border-divider bg-surface px-3 py-3 text-[14px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
      />
    </label>
  );
}
