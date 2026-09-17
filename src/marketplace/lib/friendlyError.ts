// Translate raw errors into plain-English messages non-technical users can
// act on. Anything unmatched falls through as a generic friendly line — we
// never surface Postgres error codes, SQL fragments, or stack traces to a
// household buyer.
//
// Ordering matters: patterns are tried in the order declared. Put more
// specific patterns before catch-alls.

interface Rule {
  /** Matches the raw error message (case-insensitive substring or regex). */
  match: RegExp | string;
  /** What the buyer sees instead. Short. Sentence-case. No jargon. */
  message: string;
}

const RULES: Rule[] = [
  // ── Cart / pricing engine ──────────────────────────────────────────────
  { match: /qty_below_min/i,       message: "That's less than the smallest amount we can send." },
  { match: /qty_not_stepped/i,     message: "Please choose a whole number amount." },
  { match: /product_unpriced/i,    message: "That item isn't ready to order yet — try another." },
  { match: /product_not_found/i,   message: "We couldn't find that item — it may have been removed." },
  { match: /CART_HAS_ERRORS/i,     message: "Some items in your cart can't be ordered right now — please review." },
  { match: /Cart is empty/i,       message: "Your cart is empty." },

  // ── Delivery / address ────────────────────────────────────────────────
  { match: /not in an active rider zone/i,
                                   message: "We don't deliver to that address yet. Please pick another, or choose self-pickup." },
  { match: /tradly_rider requires a delivery_address_id/i,
                                   message: "Please pick a delivery address." },
  { match: /Invalid fulfilment_method/i,
                                   message: "Please choose how you'd like to get your order." },

  // ── Auth ──────────────────────────────────────────────────────────────
  { match: /Invalid login credentials|Invalid email or password/i,
                                   message: "That email or password isn't right. Please try again." },
  { match: /Email not confirmed/i, message: "Please check your email for a confirmation link, then sign in again." },
  { match: /User already registered/i,
                                   message: "This email is already in use. Try signing in instead." },
  { match: /Rate limit|Too many/i, message: "Too many attempts. Please wait a minute, then try again." },
  { match: /NOT_SUPER_ADMIN/i,     message: "This sign-in isn't allowed here." },

  // ── Network / server ──────────────────────────────────────────────────
  { match: /Failed to fetch|Network|ENETUNREACH|ECONNREFUSED/i,
                                   message: "Couldn't reach the internet. Check your connection and try again." },
  { match: /timeout|timed out/i,   message: "That took too long. Please try again." },
  { match: /500|502|503|504/,      message: "Something's wrong on our side. Please try again in a moment." },
  { match: /401|Unauthori[sz]ed/i, message: "Your session expired. Please sign in again." },
  { match: /403|Forbidden|permission/i,
                                   message: "You don't have access to do that." },
  { match: /404|Not Found/i,       message: "That page or item is gone." },

  // ── Postgres / RPC leakage (should never reach the user, but belt) ────
  { match: /42501/,                message: "You don't have access to do that." },
  { match: /22023/,                message: "Something in your request wasn't right — please try again." },
  { match: /^fn_\w+:/,             message: "Something went wrong on our side. Please try again." },
  { match: /violates .*constraint/i,
                                   message: "That change isn't allowed — please review and try again." },
  { match: /duplicate key value/i, message: "That already exists. Try a different name." },
];

/**
 * Translate any error (or string) into a message safe to show a buyer.
 *
 * Rule of thumb: never let a raw error surface. If nothing matches, we
 * return a soft generic — the console still has the original for debugging.
 */
export function friendlyError(err: unknown, fallback?: string): string {
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : err && typeof err === "object" && "message" in err
          ? String((err as { message?: unknown }).message)
          : "";

  // Keep the original in the console so devs still have the trace.
  if (import.meta.env?.DEV && raw) {
    // eslint-disable-next-line no-console
    console.debug("[friendlyError raw]", raw);
  }

  for (const rule of RULES) {
    const matched =
      typeof rule.match === "string"
        ? raw.toLowerCase().includes(rule.match.toLowerCase())
        : rule.match.test(raw);
    if (matched) return rule.message;
  }

  return fallback ?? "Something went wrong. Please try again.";
}
