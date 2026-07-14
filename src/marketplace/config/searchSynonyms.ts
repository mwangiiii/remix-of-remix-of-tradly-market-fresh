// Local Kenyan/Swahili → common-name expansions used by the marketplace
// search. When a shopper types "dhania", we also match products with the
// keyword "coriander". Keep this list short and high-signal; the real search
// engine (Postgres trigrams + keywords array) does the rest.
//
// This is CONFIG, not data — hence its home in /config not /mockData.
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  pot: ["potato", "potatoes"],
  spud: ["potato"],
  dhania: ["coriander"],
  cilantro: ["coriander"],
  matoke: ["green bananas"],
  pepper: ["hoho"],
  capsicum: ["hoho"],
  ndengu: ["green grams"],
  minji: ["green grams"],
};
