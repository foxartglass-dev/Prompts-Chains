# PRD: Post-Publish Full Page Control System

**Priority:** HIGH
**Date:** 2026-02-07 (revised)
**Status:** Phase 1 COMPLETE. Phases 2-8 pending.

---

## Problem

Once articles are published to WordPress, everything is frozen. Users can't update content, swap components, or bulk-update pages without logging into WordPress. PromptFlow should be the single source of truth — every element on every page controllable at any time.

## Phase Overview

| Phase | Document | What It Does | Depends On |
|---|---|---|---|
| **1** | *(complete)* | Image generation, regeneration, bulk image ops, CTA bulk update | — |
| **2** | [PRD-phase-2-rebuild-service.md](PRD-phase-2-rebuild-service.md) | Shared page rebuild service + SSE utility | — |
| **3** | [PRD-phase-3-content-push.md](PRD-phase-3-content-push.md) | Push updated content to existing pages (single + bulk + batch) | Phase 2 |
| **4** | [PRD-phase-4-component-ops.md](PRD-phase-4-component-ops.md) | Bulk component re-assignment on existing pages | Phase 2 |
| **5** | [PRD-phase-5-full-rebuild.md](PRD-phase-5-full-rebuild.md) | "Nuclear option" full rebuild + refactor existing endpoints | Phases 2-4 |
| **6** | [PRD-phase-6-surgical-editing.md](PRD-phase-6-surgical-editing.md) | Surgical editing of pages we didn't create (in-place text/image swaps) | Phase 2 (loosely) |
| **7** | [PRD-phase-7-link-management.md](PRD-phase-7-link-management.md) | SEO link management — link pool, auto parent links, outbound distribution | Phases 2 + 6 |
| **8** | [PRD-phase-8-schema-injection.md](PRD-phase-8-schema-injection.md) | Schema/JSON-LD injection — bulk + custom page schema, mu-plugin approach | Pages published |

**Each phase is a self-contained document.** Copy-paste the phase document to an agent and they have everything they need — architecture context, function names, file locations, golden rules, validation steps.

**Context budget:** Each phase designed to complete under 40% context window.

**Phase 3, 4, and 6 are independent** — they all only depend on Phase 2, so they can run in parallel if desired. Phase 5 requires Phases 2-4. Phase 6 can run anytime after Phase 2. Phase 7 depends on Phases 2 and 6. **Phase 8 is fully independent** — it only needs published pages (wp_post_id), no dependency on other phases.

**Three major capabilities in this system:**
- **Phases 2-5 (Rebuild):** Delete page, recreate from scratch. For pages WE built with PromptFlow.
- **Phase 6 (Surgical Edit):** Modify widget values in-place via REST API. For pages we DIDN'T build, or pages where external edits must be preserved. Changes text and images only — cannot alter page structure/layout.
- **Phase 7 (Link Management):** SEO link injection for BOTH new and existing pages. Auto internal links to parent pages, managed outbound link pool with human review and auto-distribution.
- **Phase 8 (Schema Injection):** JSON-LD structured data on every page. Two-track system: bulk schema (LLM identifies applicable types per page) + custom schema (designated pages with their own prompts). Injected via WordPress mu-plugin, independent of SEO plugins.

## What Phase 1 Delivered (Already Complete)

### Backend Endpoints
- `POST /api/articles/:id/generate-images` — generate images for imageless articles
- `POST /api/articles/:id/regenerate-all-images` — replace ALL images on an article
- `POST /api/articles/bulk-generate-images` — bulk generate with SSE progress
- `POST /api/articles/:id/push-images` — push images to existing WP page (pre-existing)
- `POST /api/elementor/bulk-update-cta` — update CTA on all published pages (pre-existing)

### Frontend
- "Generate Images" / "Regenerate All Images" buttons (conditional)
- "Bulk Image Actions" dropdown (Generate Missing, Regenerate All, Push All)
- Progress modal with SSE streaming (React Portal)
- "Update CTA on Published Pages" button with confirmation modal

### Phase 1 Audit Result
Audited 2026-02-07. Implementation is solid — Golden Rules #1, #7, #9, #13 all respected. No issues requiring fixes in Phase 2.

## Core Architecture

**The Delete-and-Recreate Pattern:**
WordPress/Elementor's REST API cannot reliably update `_elementor_data` in-place. Every page update requires: delete old page → build new content → create new page with same slug → update `wp_post_id` in DB. This preserves the page URL.

**Key Functions (Actual Names):**

| Function | File | Note |
|---|---|---|
| `chunkContent()` | `content-chunker.js` | NOT in elementor-builder |
| `buildElementorPage()` | `elementor-builder.js:915` | |
| `getElementorMetaFields()` | `elementor-builder.js:1057` | NOT `buildElementorMeta()` |
| `createElementorPage()` | `wordpress-publisher.js` | NOT in elementor-builder |
| `getPage()` | `wordpress-publisher.js` | NOT in elementor-builder |
| `selectComponentsForArticle()` | `component-library-service.js` | Has rotation state |

**Functions that DO NOT exist:** `buildElementorMeta()`, `embedImagesInChunks()`, `deletePage()` — see phase docs for correct alternatives.
