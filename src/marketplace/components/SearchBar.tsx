import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate();
  const search = useRouterState({ select: (s) => s.location.search }) as { q?: string };
  const [value, setValue] = useState(search?.q ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    setValue(search?.q ?? "");
  }, [search?.q]);

  return (
    <div className="sticky top-0 z-30 -mx-4 border-b border-divider bg-background/95 px-4 py-3 backdrop-blur">
      <label className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3.5 h-4 w-4 text-ink-muted" />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            setValue(v);
            if (v.trim().length > 0) {
              navigate({ to: "/search", search: { q: v }, replace: true });
            }
          }}
          onFocus={() => {
            if (!location.pathname.startsWith("/search")) {
              navigate({ to: "/search", search: { q: value } });
            }
          }}
          placeholder="Search potatoes, rice, onions…"
          inputMode="search"
          className="w-full rounded-2xl border border-divider bg-surface py-3 pl-10 pr-4 text-[14px] text-ink placeholder:text-ink-muted focus:border-trust focus:outline-none focus:ring-2 focus:ring-trust/20"
        />
        {value && (
          <Link
            to="/search"
            search={{ q: "" }}
            onClick={() => setValue("")}
            className="absolute right-3 text-xs font-medium text-ink-muted hover:text-ink"
          >
            Clear
          </Link>
        )}
      </label>
    </div>
  );
}
