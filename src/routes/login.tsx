import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "../marketplace/components/AppShell";
import { TrustHeader } from "../marketplace/components/TrustHeader";
import { useSessionStore, seedProfile } from "../marketplace/store/sessionStore";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — Tradly Market" }, { name: "robots", content: "noindex" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const login = useSessionStore((s) => s.login);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [company, setCompany] = useState(seedProfile.companyName);
  const [phone, setPhone] = useState(seedProfile.phone);
  const [kra, setKra] = useState(seedProfile.kraPin);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ ...seedProfile, companyName: company, phone, kraPin: kra });
    toast.success(mode === "signin" ? "Welcome back" : "Workspace ready");
    navigate({ to: "/account" });
  };

  return (
    <AppShell hideNav>
      <div className="px-4">
        <TrustHeader title={mode === "signin" ? "Sign in" : "Create workspace"} back="/" />

        <div className="mt-6 text-center">
          <h1 className="text-2xl font-bold text-ink">Tradly Market</h1>
          <p className="mt-2 text-[13px] text-ink-muted">
            {mode === "signin" ? "Sign in to your company workspace." : "Set up a company workspace to order."}
          </p>
        </div>

        <form onSubmit={submit} className="mt-8 space-y-3">
          <Field label="Company name" value={company} onChange={setCompany} />
          <Field label="Phone" value={phone} onChange={setPhone} inputMode="tel" />
          {mode === "signup" && <Field label="KRA PIN" value={kra} onChange={setKra} />}

          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-trust px-5 py-3.5 text-[15px] font-semibold text-trust-foreground shadow-sm"
          >
            {mode === "signin" ? "Sign in" : "Create workspace"}
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
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; inputMode?: "text" | "tel" | "email";
}) {
  return (
    <label className="block">
      <span className="text-[12px] font-medium text-ink-muted">{label}</span>
      <input
        value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode}
        className="mt-1 w-full rounded-xl border border-divider bg-surface px-3 py-3 text-[14px] text-ink focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
      />
    </label>
  );
}
