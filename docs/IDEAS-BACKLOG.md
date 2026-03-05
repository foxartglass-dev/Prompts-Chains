# Ideas Backlog

Capture ideas here without getting distracted. Review weekly to prioritize.

---

## Format
```
### [Date] - [Idea Name]
**Category:** New App / Feature / Improvement
**Description:** Brief description
**Priority:** High / Medium / Low / Someday
**Notes:** Any quick thoughts
```

---

## Ideas

### 2025-01-09 - Blueprint System
**Category:** Feature
**Description:** Built-in blueprint page for documenting system architecture so AI agents can understand the codebase
**Priority:** High
**Notes:** Already implemented! This is the reference example.

---

### 2026-03-05 - Astro Adapter (WordPress-to-Astro Content Bridge)
**Category:** New App
**Description:** Middleware adapter that takes SEO content pushed to WordPress (via Caleb's tool or future custom tool) and pipes it into Astro static sites. WordPress acts as hidden content bucket, Astro pulls via REST API for the public-facing site. Enables offering Astro sites to clients who want modern frameworks without rebuilding the content pipeline.
**Priority:** High
**Notes:** WordPress REST API exposes content at /wp-json/wp/v2/ by default. Astro has built-in WordPress integration. Webhook plugin triggers Astro rebuild on new content. Could be the bridge that unlocks 3-5 new client builds immediately.

---

### 2026-03-05 - Caleb O'Dowd Tool Integration (Bridge Income)
**Category:** Improvement
**Description:** Sign up for Caleb's SEO content tool to handle current waiting clients while building own v2. Use it to generate revenue now, study the architecture for reverse-engineering later. 8-pass humanization pipeline, WordPress automation, video scripts, clean page layouts.
**Priority:** High
**Notes:** Free trial available. "Use it now, dissect it later." Produces content that can feed into the Astro adapter above.

---

### 2026-03-05 - Social Media Native Poster (Auto-Post All Platforms)
**Category:** New App
**Description:** Automatic native posting to all social media platforms (X, Facebook, Instagram, etc.). Platform-specific content formatting. Paired with audience-building framework that generates platform-specific bios, headers, content strategies.
**Priority:** Medium
**Notes:** Mentor's one-page audience system covers all platforms. Build the poster to automate the execution of that strategy.

---

### 2026-03-05 - Automatic Video/Commercial Maker
**Category:** New App
**Description:** Generate short-form video commercials for social media campaigns automatically. GIF-style feature showcases for landing pages. Could tie into the social media poster for end-to-end content automation.
**Priority:** Medium
**Notes:** Landing pages need GIFs showing features in "video play" style without actual video. This tool creates those.

---

### 2026-03-05 - Personal Deep Research Tool (Own Perplexity)
**Category:** New App
**Description:** Custom Perplexity-style research tool that can kick findings into public-facing apps, texts, and content pipelines. Deep research integrated into content generation workflows.
**Priority:** Medium
**Notes:** Every app that generates text could feed through this for research-backed content.

---

### 2026-03-05 - Landing Page Builder with Editable Backend
**Category:** New App
**Description:** Web app landing pages with a simple backend CMS for editing content without touching code. Text fields for each content block, image uploads, section toggles. Not WordPress-level complexity -- just enough to change copy, images, and CTAs. Could output to Astro, plain HTML, or embed within the web app itself.
**Priority:** Medium
**Notes:** Landing page can live inside the web app itself (it's just a web page). Backend is simple text/image fields mapped to page sections. Build the copy generator into it too -- AI writes the landing page content, you edit via backend.

---

### 2026-03-05 - PromptFlow v2 (Clean Rebuild)
**Category:** New App
**Description:** Complete rebuild of PromptFlow with modular architecture. Each subsystem (image gen loop, humanization pipeline, WP controller, prompt chains, SEO factory) as independent modules. Informed by studying Caleb's tool, mentor's frameworks, and all lessons from v1.
**Priority:** Someday
**Notes:** Don't start until current apps are shipping and generating revenue. The v1 knowledge is the foundation. A coder estimated 1.5 years of 40hr weeks to hand-code what v1 does -- that's validation the IP is real.

---

### 2026-03-05 - Astro Ecosystem Play (The "Elementor of Astro" Model)
**Category:** New App / Business Model
**Description:** Become the Elementor equivalent for Astro. Astro is free (like WordPress), so you sell the add-on layers: theme/style packages from the UI style software, SEO content automation, social media tools, etc. Tiered pricing model — free templates get people in, paid packages for style system, content engine, and automation. The UI style software already generates themes, stylesheets, and 40+ branded content pieces (logos, icons, business cards, social headers, ads). Extend that to generate Astro-compatible themes/templates. Massive market — websites dwarf apps in volume.
**Priority:** High
**Notes:** Astro uses "templates" (their word for themes). Style system would generate Astro-compatible templates. Content pieces already cover logos, icons, business cards, social headers, ads, and page graphics. Add SEO content engine as upgrade package. Add social media automation as another package. WordPress still supported for clients who want it. Custom fork of Astro possible since it's open source — can bake in proprietary integrations. Website market is orders of magnitude larger than app market.

---

### 2026-03-05 - Astro Theme Generator (Style System Integration)
**Category:** Feature
**Description:** Connect the existing UI style/theme software to Astro's template system via API. Pick a style in the UI tool, it generates a complete Astro template with that theme applied. One-click website setup with branded theme. Investigate how Astro templates are structured and what needs to be generated (layouts, components, CSS variables, etc.).
**Priority:** High
**Notes:** Need to research Astro template structure. Open source means we can customize the framework itself if needed. Could pre-build 2-3 base Astro templates, then the style system just swaps colors/fonts/spacing. Landing pages for own apps would use this same system.

---

### 2026-03-05 - Multi-Source Astro Content Aggregator
**Category:** Feature
**Description:** Pull content from multiple WordPress instances (or other sources) into a single Astro site. Use case: client with multiple business lines (e.g., residential + commercial + construction) runs separate content generation setups, all feeding into one public Astro site organized by category. Astro fetch() can hit multiple REST APIs in a single build.
**Priority:** Medium
**Notes:** Solves the multi-audience problem without requiring Caleb (or any content tool) to rebuild their architecture. Three private WordPress buckets, one public Astro site. Each WP instance gets content for one audience type. Astro pulls and organizes.

---

<!-- Add new ideas above this line -->
