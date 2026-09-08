# OFFSCRPT V49 — Global Site Controls

## Global marquee
- Marquee ticker content is now Firestore-backed and admin configurable.
- Admin can add/remove/edit ticker lines, optional links, speed and pause-on-hover.
- Ticker supports internal hash navigation and safe external links.

## Blog archive hero
- Blog hero eyebrow, title, description, background color and text color are admin configurable.
- Essay count remains live and is calculated from currently published articles.

## Footer
- Footer section titles and navigation/hub links are admin configurable.
- Internal links use real application routes.
- External links use real URLs and open safely.
- Curated topics are derived from real article categories when no override is configured.
- Configured topic categories are clickable and filter the Blog archive.
- Social/contact links are generated from live site configuration instead of hardcoded display-only text.
- Footer legal and bottom-right text are configurable.

## Sync
- All new site-wide presentation settings use the existing realtime `siteConfig/global` Firestore subscription.
- Existing Firestore admin-only write rule for `siteConfig` remains sufficient; no rule relaxation is required.
