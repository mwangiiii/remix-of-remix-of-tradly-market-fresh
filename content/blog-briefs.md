# Tradly Blog — 15 article briefs

Writer's plan. Each article is 900–1,400 words. **Do not create the routes until each article's copy exists** — thin blog stubs are worse than no blog. When you're ready to ship one:

1. Add the route at `src/routes/blog.{slug}.tsx` (or a shared `blog.$slug.tsx` reading MDX).
2. Attach `articleLd({...})` + `breadcrumbLd([{ name: "Home", path: "/" }, { name: "Blog", path: "/blog" }, { name: <title>, path: "/blog/<slug>" }])` via the route's `head()` scripts.
3. Where the brief marks "FAQ block: yes", render a visible accordion (using the same `<details>/<summary>` pattern as `/faq`) AND emit an inline `faqPageLd()` variant that lists exactly those Q/As.
4. Add the URL to the dynamic sitemap route so it starts getting crawled.

**Writing rules for LLM citation:** state facts self-containedly (an LLM should be able to lift one sentence and have it be true out of context). Short paragraphs. One comparison table or numbered checklist per article. Say "Tradly" explicitly rather than "we".

---

**1. Buy Fresh Produce Direct From Farmers in Kenya**
- URL: `/blog/buy-fresh-produce-direct-from-farmers-kenya`
- Primary intent: "buy vegetables directly from farmers no middleman" (informational → commercial)
- Outline: What "direct from farm" actually means → Why middlemen add cost → How to source direct (in person vs marketplace) → What to check (quality, consistency, invoicing) → How Tradly does it
- Internal links: → /category/fresh-produce, → /faq
- FAQ block: yes

**2. How to Find Reliable Food Suppliers for a Restaurant in Kenya**
- URL: `/blog/find-reliable-food-suppliers-restaurant-kenya`
- Primary: "how to find reliable food suppliers Kenya"
- Outline: The cost of an unreliable supplier → 7-point vetting checklist → Where to find suppliers → Managing more than one → Red flags
- Internal links: → /for/hotels-restaurants (once live)
- FAQ block: yes

**3. How to Source Fresh Produce for a Hotel in Kenya**
- URL: `/blog/source-produce-for-hotel-kenya`
- Primary: "how to source produce for a hotel Kenya"
- Outline: Hotel-scale sourcing challenges → Forecasting demand → Consistency & grading → Cost control at volume → Compliance (eTIMS)
- Internal links: → /for/hotels-restaurants, → /etims-compliance

**4. How to Reduce Food Procurement Costs in Your Restaurant**
- URL: `/blog/reduce-food-procurement-costs-restaurant`
- Primary: "reduce food procurement costs restaurant"
- Outline: Where restaurants lose money in procurement → Price comparison → Direct sourcing → Waste/spoilage → Supplier consolidation → Quantified example
- Internal links: → /how-it-works, → /wholesale, → /category/fresh-produce

**5. How to Sell Farm Produce to Hotels, Schools & Institutions**
- URL: `/blog/sell-farm-produce-to-hotels-schools-institutions`
- Primary: "how to sell farm produce to institutions"
- Outline: What institutional buyers want → Meeting volume & consistency → Pricing & payment terms → How to reach them → Marketplaces vs direct
- Internal links: → /sell, → /suppliers/register
- FAQ block: yes

**6. How to Find Buyers for Your Farm Produce in Kenya**
- URL: `/blog/find-buyers-for-farm-produce-kenya`
- Primary: "how to find buyers for my farm produce Kenya" (supply-side, high volume)
- Outline: The market-access problem for farmers → Channels (markets, brokers, institutions, marketplaces) → Pros/cons table → Getting a guaranteed market
- Internal links: → /sell, → /blog/guaranteed-market-for-farmers-offtake
- FAQ block: yes

**7. The Best Way to Procure Fresh Produce for Your Business**
- URL: `/blog/procure-fresh-produce-for-business`
- Primary: "best way to procure fresh produce for business"
- Outline: Manual vs digital procurement → The procure-to-pay flow → Scheduling delivery → Price transparency → Compliance
- Internal links: → /how-it-works, → /browse (or homepage until /browse ships)

**8. How to Get Consistent Fresh Produce Supply in Kenya**
- URL: `/blog/consistent-fresh-produce-supply-kenya`
- Primary: "how to get consistent produce supply Kenya"
- Outline: Why supply is inconsistent (seasonality, brokers) → Building supplier redundancy → Contracts & schedules → Role of aggregation
- Internal links: → /for/corporates, → /category/fresh-produce

**9. How to Manage Restaurant Suppliers in Kenya**
- URL: `/blog/manage-restaurant-suppliers-kenya`
- Primary: "how to manage restaurant suppliers Kenya"
- Outline: Supplier onboarding → Price tracking → Delivery verification (weights) → Payment control → Moving off WhatsApp/paper
- Internal links: → /how-it-works, → /blog/digitize-procurement-kenyan-smes

**10. eTIMS Explained: What Buyers Should Know About Compliant Suppliers**
- URL: `/blog/etims-explained-compliant-suppliers`
- Primary: "eTIMS compliant supplier Kenya"
- Outline: What eTIMS is (plain language) → Why it matters for buyers → Risks of non-compliant suppliers → How to verify → How Tradly handles it
- Internal links: → /etims-compliance
- FAQ block: yes

**11. Understanding Vegetable Market Prices in Kenya**
- URL: `/blog/vegetable-market-prices-kenya-guide`
- Primary: "market price vegetables Kenya today" (high volume, recurring)
- Outline: What drives vegetable prices (season, weather, fuel) → How to read price trends → Budgeting for procurement → Where to check current prices
- Internal links: → /market-prices, → /wholesale
- Note: refresh monthly to stay ranking.

**12. Digitizing Procurement for Kenyan SMEs**
- URL: `/blog/digitize-procurement-kenyan-smes`
- Primary: "digitize restaurant procurement Kenya"
- Outline: The hidden cost of manual procurement → What "digital procurement" includes → Purchase orders, approvals, price comparison → Getting started
- Internal links: → /how-it-works

**13. How to Reduce Spoilage in Your Restaurant Supply Chain**
- URL: `/blog/reduce-spoilage-restaurant-supply-chain`
- Primary: "how to reduce spoilage in restaurant supply"
- Outline: Where spoilage happens → Ordering discipline → Fresher/faster sourcing → Delivery timing → Storage & FIFO
- Internal links: → /category/fresh-produce, → /blog/reduce-food-procurement-costs-restaurant

**14. Guaranteed Market for Farmers: How Off-Take Works**
- URL: `/blog/guaranteed-market-for-farmers-offtake`
- Primary: "guaranteed market for farmers Kenya"
- Outline: What an off-take arrangement is → Benefits for farmers → How aggregation creates steady demand → How to join
- Internal links: → /sell

**15. What Is a B2B Procurement Marketplace?**
- URL: `/blog/what-is-b2b-procurement-marketplace`
- Primary: "what is a B2B procurement marketplace" (definition — strong LLM target)
- Outline: Definition → How it differs from B2C → How buyers and suppliers use it → Benefits → Examples in Kenya (position Tradly)
- Internal links: → /, → /how-it-works, → /sell
- Note: keep the opening sentence a clean, quotable definition — this is the prime "definition" article LLMs cite.
