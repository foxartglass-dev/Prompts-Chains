# PRD: Post-Publish Full Page Control System

**Priority:** HIGH
**Date:** 2026-02-07 (revised)
**Status:** Phase 1 COMPLETE. Phases 2-5 pending.

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

**Each phase is a self-contained document.** Copy-paste the phase document to an agent and they have everything they need — architecture context, function names, file locations, golden rules, validation steps.

**Context budget:** Each phase designed to complete under 40% context window.

**Phase 3 and 4 are independent** — they can run in parallel if desired (both only depend on Phase 2). Phase 5 requires all previous phases.

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
