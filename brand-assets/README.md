# Brand assets — source of truth

This folder holds the **unmodified brand-source images** for the three
Tradly front-ends:

| Sibling repo                        | Public folder |
| ----------------------------------- | ------------- |
| tradly-market (this repo)           | `public/`     |
| tradly-flow                         | `../tradly-flow/public/` |
| remix-of-tradly-marketing-suite     | `../remix-of-tradly-marketing-suite/public/` |

## Files

- `icon-source.png` — 1024×1024 RGBA. The Tradly mark on a transparent
  background. Feeds every square icon variant (favicons, apple-touch,
  PWA install, maskable).
- `og-source.png` — 1731×909 RGB. Landscape marketing hero. Feeds the
  1200×630 `og-default.jpg` shown when someone shares a Tradly URL on
  WhatsApp / LinkedIn / Facebook / Twitter/X / Slack.
- `icon-alt-source.png` — 1254×1254. Alternate/spare — not consumed by
  the current pipeline.

**Do not serve these directly.** They're kept out of `public/` on
purpose — a 1.3 MB PNG has no business being fetched by a browser tab.

## Regenerating the shipped assets

```powershell
node scripts/build-brand-assets.mjs
```

By default it writes to every sibling `public/` folder. Pass
`--only=<market|flow|marketing>` to target one.

The script is idempotent — re-running it just overwrites the outputs.
Commit the outputs alongside the sources so we don't require the
generator to be part of every deploy.
