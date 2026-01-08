# PromptFlow Image System Architecture

## Complete System Documentation & Diagrams

**Created:** 2026-01-08
**Purpose:** Document current state, desired state, and required changes for the image generation and publishing system.

---

## Table of Contents
1. [System Overview](#1-system-overview)
2. [Current State - How It Actually Works](#2-current-state---how-it-actually-works)
3. [Desired State - How It Should Work](#3-desired-state---how-it-should-work)
4. [Toggle Dependency Matrix](#4-toggle-dependency-matrix)
5. [Issues Identified](#5-issues-identified)
6. [Required Changes](#6-required-changes)
7. [Key File Locations](#7-key-file-locations)

---

## 1. System Overview

### What This System Does
The image system creates AI-generated images for articles and publishes them to WordPress. The flow is:

```
Article Content → Image Generation → Image Bank → Article Page → WordPress
```

### Main Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **WordPress Publishing Toggles** | `App.tsx:2640-2766` | Controls where content goes (Draft vs WordPress) |
| **Image Source Selection** | `ImageCreationSection.tsx:6662-6685` | Bank vs Generate Live |
| **Smart Content Matching** | `ImageCreationSection.tsx:8332-8448` | AI-based image-to-content matching |
| **Matching Strategy** | `ImageCreationSection.tsx:8354-8370` | bank_first, generate_first, bank_only, generate_only |
| **Generate Live Modes** | `ImageCreationSection.tsx:6687-6728` | main_prompt, guided_gpt, smart_prompt |
| **Server Processing** | `server/routes/elementor.js:300-1200` | Actual image selection/generation logic |
| **Image Pipeline** | `server/services/image-pipeline.js` | Full generation flow orchestration |

---

## 2. Current State - How It Actually Works

### 2.1 WordPress Publishing Toggles (CURRENT)

```
┌─────────────────────────────────────────────────────────────────┐
│                   WORDPRESS PUBLISHING TOGGLES                   │
│                        (Currently INDEPENDENT)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │   IMAGE     │     │   ARTICLE   │     │    META     │       │
│   │             │     │             │     │             │       │
│   │ ┌───┬───┬──┐│     │ ┌───┬────┐ │     │ ┌───┬────┐ │       │
│   │ │Off│Dra│WP││     │ │Dra│ WP │ │     │ │Dra│ WP │ │       │
│   │ └───┴───┴──┘│     │ └───┴────┘ │     │ └───┴────┘ │       │
│   │             │     │             │     │             │       │
│   │ wpPublishMode│    │articlePubl- │     │metaPublish- │       │
│   │             │     │ishMode      │     │Mode         │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
│   PROBLEM: These can be set to ANY combination independently!    │
│   e.g., Image=WordPress while Article=Draft (BROKEN scenario)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Current Code Location:** `App.tsx:2640-2766`

**Current Behavior:**
- All three toggles operate independently
- User can set Image to "WordPress" while Article is in "Draft" - this breaks the flow
- User can set Meta to "WordPress" while Article is in "Draft" - this also breaks

### 2.2 Image Source & Smart Matching (CURRENT)

```
┌─────────────────────────────────────────────────────────────────┐
│                       IMAGE SOURCE SELECTION                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────┐     ┌────────────────────┐             │
│   │   Pull from Bank   │     │   Generate Live    │             │
│   │   (integration_    │     │   (integration_    │             │
│   │    mode: 'bank')   │     │    mode: 'live')   │             │
│   └────────────────────┘     └────────────────────┘             │
│              │                          │                        │
│              │                          │                        │
│              ▼                          ▼                        │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              FALLBACK CHECKBOX (REDUNDANT!)              │  │
│   │    ☑ Fallback: Generate if bank is empty or no match     │  │
│   │              (fallback_to_live: boolean)                 │  │
│   │                                                          │  │
│   │    PROBLEM: This duplicates "Bank First" strategy!       │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              SMART CONTENT MATCHING                      │  │
│   │                    Toggle: ON/OFF                        │  │
│   │              (smart_matching_enabled)                    │  │
│   └──────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │              MATCHING STRATEGY                           │  │
│   │   ┌───────────────┐  ┌───────────────┐                   │  │
│   │   │  Bank First   │  │Generate First │                   │  │
│   │   │ Search bank → │  │ Always fresh →│                   │  │
│   │   │ Generate if   │  │ Save to bank  │                   │  │
│   │   │ no match      │  │               │                   │  │
│   │   └───────────────┘  └───────────────┘                   │  │
│   │   ┌───────────────┐  ┌───────────────┐                   │  │
│   │   │  Bank Only    │  │Generate Only  │                   │  │
│   │   │ Only existing │  │ Always new →  │                   │  │
│   │   │ Skip if none  │  │ Skip bank     │                   │  │
│   │   └───────────────┘  └───────────────┘                   │  │
│   │                                                          │  │
│   │   PROBLEM: ALL 4 options available regardless of         │  │
│   │   whether "Pull from Bank" or "Generate Live" selected!  │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Generate Live Prompt Modes (CURRENT)

```
┌─────────────────────────────────────────────────────────────────┐
│           GENERATE LIVE PROMPT MODES                            │
│         (Only visible when integration_mode === 'live')          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│   │   Main Prompt   │  │   Guided GPT    │  │  Smart Prompt   │ │
│   │                 │  │                 │  │    (Legacy)     │ │
│   │ Avatar template │  │ GPT + guardrails│  │ GPT-4o-mini     │ │
│   │ + placeholders  │  │                 │  │ analysis        │ │
│   │ + smart match   │  │                 │  │                 │ │
│   └────────┬────────┘  └────────┬────────┘  └────────┬────────┘ │
│            │                    │                    │          │
│            ▼                    ▼                    ▼          │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │                    SERVER PROCESSING                     │  │
│   │              (elementor.js:965-1007)                     │  │
│   │                                                          │  │
│   │   livePromptMode = config.live_prompt_mode               │  │
│   │                                                          │  │
│   │   IF main_prompt → Use avatar.mainPrompt + smart match   │  │
│   │   IF guided_gpt → Use GPT model with guardrails          │  │
│   │   IF smart_prompt → Use GPT-4o-mini to analyze content   │  │
│   └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Complete Current Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CURRENT COMPLETE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ARTICLE GENERATION (Prompt Chain)
           │
           ▼
  ┌────────────────┐
  │  Article Ready │
  └───────┬────────┘
          │
          ▼
  ┌────────────────────────────────────────────────────────────────┐
  │                    IMAGE SOURCE DECISION                        │
  │  ┌─────────────────┐          ┌─────────────────┐              │
  │  │ Pull from Bank  │    OR    │  Generate Live  │              │
  │  │ integration_mode│          │ integration_mode│              │
  │  │    = 'bank'     │          │    = 'live'     │              │
  │  └────────┬────────┘          └────────┬────────┘              │
  └───────────┼────────────────────────────┼───────────────────────┘
              │                            │
              ▼                            ▼
  ┌───────────────────────┐    ┌───────────────────────────────────┐
  │  Query Image Bank     │    │  PROMPT MODE SELECTION            │
  │  by workflow_id       │    │  ┌─────────┐┌────────┐┌────────┐  │
  │  + avatar tag         │    │  │  Main   ││ Guided ││ Smart  │  │
  │                       │    │  │ Prompt  ││  GPT   ││ Prompt │  │
  └───────────┬───────────┘    │  └────┬────┘└───┬────┘└───┬────┘  │
              │                └───────┼─────────┼─────────┼───────┘
              ▼                        │         │         │
  ┌───────────────────────┐            ▼         ▼         ▼
  │  SMART MATCHING?      │    ┌──────────────────────────────────┐
  │                       │    │  image-pipeline.js               │
  │  IF enabled:          │    │  processArticleWithImages()      │
  │  - Score by keywords  │    │                                  │
  │  - Primary first      │    │  → Generate AI prompts           │
  │  - No duplicates      │    │  → Call image model              │
  │  - Secondary fallback │    │  → Upload to WP media library    │
  └───────────┬───────────┘    │  → Return wpUrl                  │
              │                └────────────────┬─────────────────┘
              │                                 │
              ▼                                 ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                    IMAGES SELECTED/GENERATED                   │
  │                    (with wpUrl from media library)             │
  └───────────────────────────────────────────────────────────────┘
              │
              ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                    PUBLISH MODE CHECK                          │
  │                                                                │
  │   articlePublishMode === 'wordpress'?                          │
  │        │                                                       │
  │        ├── YES → Publish article to WordPress                  │
  │        │         │                                             │
  │        │         ▼                                             │
  │        │    wpPublishMode !== 'off'?                           │
  │        │         │                                             │
  │        │         ├── YES, 'draft' → Save images to article DB  │
  │        │         │                  but DON'T embed in WP page │
  │        │         │                                             │
  │        │         └── YES, 'wordpress' → Embed images in        │
  │        │                                WP page content        │
  │        │                                                       │
  │        │    metaPublishMode === 'wordpress'?                   │
  │        │         │                                             │
  │        │         └── YES → Push SEO meta to WordPress          │
  │        │                                                       │
  │        └── NO → Save to Article DB only (draft)                │
  │                                                                │
  └───────────────────────────────────────────────────────────────┘
```

---

## 3. Desired State - How It Should Work

### 3.1 WordPress Publishing Toggles (DESIRED)

```
┌─────────────────────────────────────────────────────────────────┐
│                   WORDPRESS PUBLISHING TOGGLES                   │
│                      (DEPENDENT - Article Controls)              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                        ┌─────────────┐                          │
│                        │   ARTICLE   │  ← MASTER CONTROL        │
│                        │             │                          │
│                        │ ┌───┬────┐ │                          │
│                        │ │Dra│ WP │ │                          │
│                        │ └───┴────┘ │                          │
│                        └──────┬──────┘                          │
│                               │                                  │
│              ┌────────────────┼────────────────┐                │
│              │                                 │                │
│              ▼                                 ▼                │
│   ┌─────────────────┐             ┌─────────────────┐          │
│   │     IMAGE       │             │      META       │          │
│   │                 │             │                 │          │
│   │  ┌───┬───┬──┐   │             │  ┌───┬────┐    │          │
│   │  │Off│Dra│WP│   │             │  │Dra│ WP │    │          │
│   │  └───┴───┴──┘   │             │  └───┴────┘    │          │
│   │                 │             │                 │          │
│   │  CONSTRAINED BY │             │  CONSTRAINED BY │          │
│   │  ARTICLE STATE  │             │  ARTICLE STATE  │          │
│   └─────────────────┘             └─────────────────┘          │
│                                                                  │
│   RULES:                                                        │
│   ┌────────────────────────────────────────────────────────┐   │
│   │ 1. If Article = Draft → Image and Meta MUST = Draft     │   │
│   │    (or Off for Image)                                   │   │
│   │                                                         │   │
│   │ 2. If Article = WordPress → Image and Meta CAN be any   │   │
│   │    (Draft, WordPress, or Off for Image)                 │   │
│   │                                                         │   │
│   │ 3. If user switches Article from WP to Draft:           │   │
│   │    → AUTO-SWITCH Image and Meta to Draft                │   │
│   └────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.2 Image Source & Matching Strategy (DESIRED)

```
┌─────────────────────────────────────────────────────────────────┐
│                IMAGE SOURCE & MATCHING STRATEGY                  │
│                    (CONSTRAINED RELATIONSHIP)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────────┐          ┌────────────────────┐        │
│   │   Pull from Bank   │          │   Generate Live    │        │
│   │ integration_mode:  │          │ integration_mode:  │        │
│   │      'bank'        │          │      'live'        │        │
│   └─────────┬──────────┘          └─────────┬──────────┘        │
│             │                               │                    │
│             │  CONSTRAINS                   │  CONSTRAINS        │
│             ▼                               ▼                    │
│   ┌────────────────────┐          ┌────────────────────┐        │
│   │  MATCHING STRATEGY │          │  MATCHING STRATEGY │        │
│   │     (BANK MODES)   │          │   (GENERATE MODES) │        │
│   │                    │          │                    │        │
│   │ ┌────────────────┐ │          │ ┌────────────────┐ │        │
│   │ │  ✓ Bank First  │ │          │ │ ✓ Generate     │ │        │
│   │ │    Search bank │ │          │ │   First        │ │        │
│   │ │    → Generate  │ │          │ │   Always fresh │ │        │
│   │ │    if no match │ │          │ │   → Save bank  │ │        │
│   │ └────────────────┘ │          │ └────────────────┘ │        │
│   │ ┌────────────────┐ │          │ ┌────────────────┐ │        │
│   │ │  ✓ Bank Only   │ │          │ │ ✓ Generate     │ │        │
│   │ │    Only exist- │ │          │ │   Only         │ │        │
│   │ │    ing images  │ │          │ │   Always new   │ │        │
│   │ └────────────────┘ │          │ └────────────────┘ │        │
│   │ ┌────────────────┐ │          │ ┌────────────────┐ │        │
│   │ │  ✗ Generate    │ │          │ │ ✗ Bank First   │ │        │
│   │ │    First       │ │          │ │                │ │        │
│   │ │    DISABLED    │ │          │ │   DISABLED     │ │        │
│   │ └────────────────┘ │          │ └────────────────┘ │        │
│   │ ┌────────────────┐ │          │ ┌────────────────┐ │        │
│   │ │  ✗ Generate    │ │          │ │ ✗ Bank Only    │ │        │
│   │ │    Only        │ │          │ │                │ │        │
│   │ │    DISABLED    │ │          │ │   DISABLED     │ │        │
│   │ └────────────────┘ │          │ └────────────────┘ │        │
│   └────────────────────┘          └────────────────────┘        │
│                                                                  │
│   REMOVE: "Fallback: Generate if bank is empty" checkbox        │
│   REASON: Duplicates "Bank First" functionality                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Complete Desired Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DESIRED COMPLETE FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  ARTICLE GENERATION (Prompt Chain)
           │
           ▼
  ┌────────────────┐
  │  Article Ready │
  └───────┬────────┘
          │
          ▼
  ┌────────────────────────────────────────────────────────────────┐
  │                    IMAGE SOURCE DECISION                        │
  │  ┌─────────────────┐          ┌─────────────────┐              │
  │  │ Pull from Bank  │    OR    │  Generate Live  │              │
  │  └────────┬────────┘          └────────┬────────┘              │
  │           │                            │                        │
  │           ▼                            ▼                        │
  │  ┌─────────────────┐          ┌─────────────────┐              │
  │  │ MATCHING:       │          │ MATCHING:       │              │
  │  │ • Bank First    │          │ • Generate First│              │
  │  │ • Bank Only     │          │ • Generate Only │              │
  │  │ (others hidden) │          │ (others hidden) │              │
  │  └────────┬────────┘          └────────┬────────┘              │
  └───────────┼────────────────────────────┼───────────────────────┘
              │                            │
              ▼                            ▼
  ┌───────────────────────┐    ┌───────────────────────────────────┐
  │  Query Image Bank     │    │  PROMPT MODE SELECTION            │
  │  + Smart Matching     │    │  Main Prompt | Guided | Smart     │
  │                       │    │                                   │
  │  IF Bank First:       │    │  Generate via image-pipeline.js   │
  │  → Try bank           │    │  → Upload to WP media library     │
  │  → Generate if fail   │    │  → Return wpUrl                   │
  │                       │    │                                   │
  │  IF Bank Only:        │    │  IF Generate First:               │
  │  → Use bank or skip   │    │  → Generate new                   │
  │                       │    │  → Save to bank                   │
  │                       │    │                                   │
  │                       │    │  IF Generate Only:                │
  │                       │    │  → Generate new                   │
  │                       │    │  → Skip bank                      │
  └───────────┬───────────┘    └────────────────┬──────────────────┘
              │                                 │
              └─────────────┬───────────────────┘
                            │
                            ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                    IMAGES READY (with wpUrl)                   │
  └───────────────────────────────────────────────────────────────┘
                            │
                            ▼
  ┌───────────────────────────────────────────────────────────────┐
  │                 DEPENDENT PUBLISH MODE CHECK                   │
  │                                                                │
  │   ARTICLE toggle is MASTER                                     │
  │        │                                                       │
  │        ├── articlePublishMode = 'draft'                        │
  │        │         │                                             │
  │        │         ▼                                             │
  │        │    FORCE: Image = 'off' or 'draft'                    │
  │        │    FORCE: Meta = 'draft'                              │
  │        │    → Save article to DB only                          │
  │        │    → Save images to article record                    │
  │        │    → Save meta to article record                      │
  │        │                                                       │
  │        └── articlePublishMode = 'wordpress'                    │
  │                  │                                             │
  │                  ▼                                             │
  │             Publish article to WordPress                       │
  │                  │                                             │
  │                  ├── wpPublishMode = 'off'                     │
  │                  │    → No images in WP page                   │
  │                  │                                             │
  │                  ├── wpPublishMode = 'draft'                   │
  │                  │    → Images saved to article DB             │
  │                  │    → NOT embedded in WP page                │
  │                  │                                             │
  │                  └── wpPublishMode = 'wordpress'               │
  │                       → Embed images in WP page                │
  │                                                                │
  │                  metaPublishMode?                              │
  │                  ├── 'draft' → Save meta to article only       │
  │                  └── 'wordpress' → Push SEO meta to WP         │
  │                                                                │
  └───────────────────────────────────────────────────────────────┘
```

---

## 4. Toggle Dependency Matrix

### 4.1 WordPress Publishing Toggles Matrix

#### CURRENT (Incorrect - All Independent)

| Article | Image | Meta | Result | Valid? |
|---------|-------|------|--------|--------|
| Draft | Off | Draft | Article DB only | ✓ Valid |
| Draft | Draft | Draft | Article DB only, images saved | ✓ Valid |
| Draft | **WordPress** | Draft | **BROKEN** - Can't push images without article | ✗ INVALID |
| Draft | Draft | **WordPress** | **BROKEN** - Can't push meta without article | ✗ INVALID |
| WordPress | Off | Draft | Article to WP, no images, meta saved | ✓ Valid |
| WordPress | Draft | Draft | Article to WP, images saved, meta saved | ✓ Valid |
| WordPress | WordPress | Draft | Article to WP with images, meta saved | ✓ Valid |
| WordPress | WordPress | WordPress | Full publish with images + meta | ✓ Valid |

#### DESIRED (Article Controls Others)

| Article | Image (Allowed) | Meta (Allowed) | Behavior |
|---------|-----------------|----------------|----------|
| **Draft** | Off, Draft | Draft only | Everything stays in DB |
| **WordPress** | Off, Draft, WordPress | Draft, WordPress | Article to WP; images/meta per their settings |

### 4.2 Image Source vs Matching Strategy Matrix

#### CURRENT (No Constraints - WRONG)

| Image Source | Bank First | Generate First | Bank Only | Generate Only |
|--------------|------------|----------------|-----------|---------------|
| Pull from Bank | ✓ | ✓ | ✓ | ✓ |
| Generate Live | ✓ | ✓ | ✓ | ✓ |

#### DESIRED (Constrained)

| Image Source | Bank First | Generate First | Bank Only | Generate Only |
|--------------|------------|----------------|-----------|---------------|
| **Pull from Bank** | ✓ Available | ✗ Disabled | ✓ Available | ✗ Disabled |
| **Generate Live** | ✗ Disabled | ✓ Available | ✗ Disabled | ✓ Available |

### 4.3 Smart Matching Toggle Impact

| Smart Matching | Smart Matching Mode Used? | 4 Colored Rules Used? | 2 Blue Rules Used? |
|----------------|---------------------------|----------------------|-------------------|
| **OFF** | No | No | Yes (static fallback) |
| **ON** | Yes | Yes | Yes |

---

## 5. Issues Identified

### Issue 1: WordPress Toggles Are Independent
**Location:** `App.tsx:2640-2766`
**Problem:** User can set Image or Meta to "WordPress" while Article is in "Draft"
**Impact:** System tries to push images/meta to WordPress page that doesn't exist

### Issue 2: Redundant Fallback Checkbox
**Location:** `ImageCreationSection.tsx:8323-8327`
**Problem:** "Fallback: Generate if bank is empty or no match" duplicates "Bank First" strategy
**Impact:** Confusion, potential conflicts

### Issue 3: Matching Strategy Not Constrained by Image Source
**Location:** `ImageCreationSection.tsx:8354-8370`
**Problem:** All 4 strategies available regardless of bank/live mode selection
**Impact:** Illogical combinations possible (e.g., "Generate Only" when "Pull from Bank" selected)

### Issue 4: Generate Live Not Working
**Location:** Server-side logic in `elementor.js`
**Problem:** When "Generate Live" is selected, system still pulls from bank
**Impact:** Live generation never actually happens

### Issue 5: Smart Matching Toggle State Not Reflected in Article Detail
**Location:** Article detail page title/header
**Problem:** Shows "Smart Matching: ON" even when the toggle is OFF
**Impact:** Confusing debugging, unclear what settings were used

---

## 6. Required Changes

### Change 1: Implement Toggle Dependencies

**File:** `App.tsx`
**Lines:** ~2640-2766

```javascript
// When Article toggle changes to 'draft':
const handleArticlePublishModeChange = (mode) => {
  setCurrentProjectState(p => ({
    ...p,
    articlePublishMode: mode,
    // AUTO-CASCADE: If article goes to draft, image and meta must follow
    ...(mode === 'draft' ? {
      wpPublishMode: p.wpPublishMode === 'wordpress' ? 'draft' : p.wpPublishMode,
      metaPublishMode: 'draft'
    } : {})
  }));
};

// Disable WordPress option for Image/Meta when Article is Draft
const canSelectWordPress = currentProject.state.articlePublishMode === 'wordpress';
```

### Change 2: Remove Redundant Fallback Checkbox

**File:** `ImageCreationSection.tsx`
**Lines:** 8323-8327

```javascript
// DELETE THESE LINES:
<label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-900/50 rounded mt-3">
  <input type="checkbox" checked={settings.fallback_to_live} onChange={(e) => updateSettings({ fallback_to_live: e.target.checked })} ... />
  <span className="text-sm text-amber-400">Fallback: Generate if bank is empty or no match</span>
</label>
```

### Change 3: Constrain Matching Strategy by Image Source

**File:** `ImageCreationSection.tsx`
**Lines:** 8354-8370

```javascript
// Filter available strategies based on integration_mode
const availableStrategies = settings.integration_mode === 'bank'
  ? [
      { value: 'bank_first', label: 'Bank First', desc: 'Search bank → Generate if no match' },
      { value: 'bank_only', label: 'Bank Only', desc: 'Only use existing bank images' }
    ]
  : [
      { value: 'generate_first', label: 'Generate First', desc: 'Always fresh → Save to bank' },
      { value: 'generate_only', label: 'Generate Only', desc: 'Always new → Skip bank' }
    ];

// Auto-switch strategy when integration_mode changes
useEffect(() => {
  if (settings.integration_mode === 'bank' &&
      (settings.smart_matching_mode === 'generate_first' || settings.smart_matching_mode === 'generate_only')) {
    updateSettings({ smart_matching_mode: 'bank_first' });
  }
  if (settings.integration_mode === 'live' &&
      (settings.smart_matching_mode === 'bank_first' || settings.smart_matching_mode === 'bank_only')) {
    updateSettings({ smart_matching_mode: 'generate_first' });
  }
}, [settings.integration_mode]);
```

### Change 4: Fix Generate Live Logic

**File:** `server/routes/elementor.js`
**Lines:** ~960-1000

Need to ensure `effectiveGenerateLive` is properly set when `integration_mode === 'live'`:

```javascript
// Current issue: effectiveGenerateLive might not be true when it should be
// Fix: Explicitly check integration_mode
const integrationMode = config.integration_mode || 'bank';
let effectiveGenerateLive = integrationMode === 'live';
let effectiveUseBank = integrationMode === 'bank';
```

---

## 7. Key File Locations

| Component | File | Lines |
|-----------|------|-------|
| WordPress Toggle UI | `App.tsx` | 2640-2766 |
| Toggle State Usage | `App.tsx` | 1231-1327 |
| Image Source UI | `ImageCreationSection.tsx` | 6662-6685 |
| Generate Live Modes UI | `ImageCreationSection.tsx` | 6687-6728 |
| Fallback Checkbox | `ImageCreationSection.tsx` | 8323-8327 |
| Smart Matching Toggle | `ImageCreationSection.tsx` | 8332-8448 |
| Matching Strategy UI | `ImageCreationSection.tsx` | 8354-8370 |
| 4 Colored Rules UI | `ImageCreationSection.tsx` | 8463-8522 |
| 2 Blue Rules UI | `ImageCreationSection.tsx` | 8524-8569 |
| Settings Interface | `ImageCreationSection.tsx` | 357-377 |
| Default Settings | `ImageCreationSection.tsx` | 427-443 |
| Server Publish Logic | `server/routes/elementor.js` | 300-1200 |
| Server Bank Logic | `server/routes/elementor.js` | 439-920 |
| Server Live Logic | `server/routes/elementor.js` | 957-1180 |
| Image Pipeline | `server/services/image-pipeline.js` | 1-700 |

---

## Summary: Priority Order for Fixes

1. **HIGH:** Implement WordPress toggle dependencies (Article controls Image/Meta)
2. **HIGH:** Constrain matching strategy options by image source
3. **MEDIUM:** Remove redundant fallback checkbox
4. **MEDIUM:** Fix Generate Live not actually generating
5. **LOW:** Fix Smart Matching toggle state display in article detail

---

*Document last updated: 2026-01-08*
