# LumaFood SEO Blog Pack

## What this adds
- **Fully crawlable, indexable blog pages** under `/blog/` (best practice for SEO).
- **`robots.txt` and `sitemap.xml` in the site root** so search engines can discover and crawl pages correctly.
- A URL structure optimised for **long-form content, backlinks, and rankings**.

## Where to paste
1. Copy this entire folder into the **repository root**  
   (the same level as `index.html`, `products/`, `about/`, etc).

2. Add or edit blog articles here:
   - `blog/2025-10-24-the-health-benefits-of-matcha/index.html`
   - `blog/2025-09-16-matcha-soda-vs-coffee-nz/index.html`

   Each folder represents **one blog post URL**.

## Deploy
- Commit and push to GitHub.
- Cloudflare Pages will **automatically deploy** and expose:
  - `/blog/...` article pages
  - `/robots.txt`
  - `/sitemap.xml`

## Notes
- All blog pages are **static HTML** for maximum speed, crawlability, and long-term SEO stability.
- No framework, no client-side rendering, no SEO risk.
