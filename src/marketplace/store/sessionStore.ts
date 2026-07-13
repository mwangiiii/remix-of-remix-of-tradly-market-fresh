import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CompanyProfile {
  companyName: string;
  kraPin: string;
  phone: string;
  email: string;
  plan: "marketplace_only" | "full";
  addresses: { id: string; label: string; line: string }[];
  team: { name: string; role: "Procurement Officer" | "Finance Officer" | "Store Manager" }[];
}

interface SessionState {
  isAuthenticated: boolean;
  profile: CompanyProfile | null;
  login: (profile: CompanyProfile) => void;
  logout: () => void;
}

const defaultProfile: CompanyProfile = {
  companyName: "Serena Kitchens Ltd",
  kraPin: "P051234567X",
  phone: "+254 712 345 678",
  email: "procurement@serenakitchens.co.ke",
  plan: "marketplace_only",
  addresses: [
    { id: "a1", label: "Main Kitchen", line: "Serena Hotel, Kenyatta Ave, Nairobi" },
    { id: "a2", label: "Westlands Branch", line: "The Oval, Ring Road, Westlands" },
  ],
  team: [
    { name: "Grace Mwangi", role: "Procurement Officer" },
    { name: "David Otieno", role: "Finance Officer" },
    { name: "Peter Kariuki", role: "Store Manager" },
  ],
};

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      profile: null,
      login: (profile) => set({ isAuthenticated: true, profile }),
      logout: () => set({ isAuthenticated: false, profile: null }),
    }),
    { name: "tradly-marketplace-session" },
  ),
);

export const seedProfile = defaultProfile;
