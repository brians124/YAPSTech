# YAPSTech – setup

## 1. Turn on real accounts (Supabase)
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Settings → API → copy **Project URL** and **anon public key** into `yaps-config.js`.
4. Authentication → URL Configuration → set Site URL to your live address (and add `.../account.html` to Redirect URLs).
5. Orders appear in Table editor → `orders`. Change `status` there (pending → confirmed → shipped → delivered).

Until step 3 is done the site runs in DEMO mode (accounts/orders stored only in each visitor's browser).

## 2. Get found on Google for "YAPSTech"
1. Deploy to GitHub Pages (or a custom domain). If the address is not `https://brians124.github.io/YAPSTech/`, run
   `python3 tools/set-site-url.py https://your-address/`
2. Open https://search.google.com/search-console → add your site → verify (HTML tag: paste it into the `<head>` of `index.html`).
3. Search Console → Sitemaps → submit `sitemap.xml`. URL Inspection → Request indexing for the home page.
4. Use the name "YAPSTech" consistently (Google Business Profile, Facebook, LinkedIn, WhatsApp Business) and link them to the site.
   A custom domain (e.g. yapstech.com) ranks far better than a github.io subpath; robots.txt only works on a domain root.
