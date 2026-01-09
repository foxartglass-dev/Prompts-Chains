# CLI Power User Guide for Big Projects

## 1. CLAUDE.md - Your Project Brain

Create a `CLAUDE.md` file in your project root. Every agent reads this FIRST.

```markdown
# Project: PromptFlow

## What This Is
SEO page factory - generates articles, images, pushes to WordPress.

## Critical Rules (READ BEFORE TOUCHING CODE)
1. Push order: Images → Page → Meta (NEVER change this)
2. smart_matching_mode is source of truth for bank/live fallback
3. Never overwrite generated_images with empty array
4. website.seo_plugin determines SEO plugin, not hardcoded

## Current State
- Last worked on: [date]
- What's broken: [nothing / description]
- Next priority: [what to work on]

## Quick Commands
- `npm run dev` - Start dev server
- `npm test` - Run tests
- Check logs: `cat logs/server-latest.log`

## Don't Touch These (Stable)
- src/components/WorkflowNavigation.tsx
- server/routes/clients.js

## Actively Being Worked On
- server/routes/elementor.js (image pipeline)
- src/components/articles/ArticleListView.tsx
```

Every new agent session reads this automatically and knows what's what.

---

## 2. Custom Slash Commands

Create these in `.claude/commands/`:

### `/status.md` - Quick project health check
```markdown
Check the current state of the project:
1. Run `git status` to see uncommitted changes
2. Run `git log --oneline -5` to see recent commits
3. Check if dev server is running
4. Report any obvious issues
```

### `/test-images.md` - Test the image pipeline specifically
```markdown
Test the image pipeline end-to-end:
1. Check that articles.generated_images has data
2. Verify push-images endpoint works
3. Confirm elementor/publish embeds images
4. Report what's working and what's not
```

### `/start.md` - Beginning of session ritual
```markdown
Starting a new session. Before doing ANY work:
1. Read CLAUDE.md for project context
2. Read More > Blueprint in the app
3. Run `git status` to see current state
4. Ask user what they want to work on today
Do NOT start coding until you understand the system.
```

---

## 3. Hooks for Automation

In your settings, add hooks that trigger automatically:

### Pre-commit hook (catches mistakes)
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit",
        "command": "echo 'Editing file - remember to test after!'"
      }
    ]
  }
}
```

### Session start reminder
The `/start` command above, but you can also make it automatic.

---

## 4. Git Workflow for AI Development

### Branch Strategy
```
main (stable, always works)
  └── feature/image-pipeline
  └── feature/meta-push
  └── fix/seo-plugin-sync
```

### Commit Often, Commit Small
Instead of one big commit at end of session:
- Commit after each working piece
- Easy to revert if something breaks
- Clear history of what changed

### Tag Working States
```bash
git tag v1.0-images-working
git tag v1.1-meta-push-working
```
If things break, you can always go back.

---

## 5. Session Discipline

### The 3-Phase Session
```
PHASE 1: ORIENT (5 min)
- Read CLAUDE.md
- Read Blueprint
- Check git status
- Understand what you're working on

PHASE 2: EXECUTE
- Do the work
- Commit often
- Test as you go

PHASE 3: DEBRIEF (5 min)
- /debrief
- Update Blueprint
- Update CLAUDE.md "Current State"
- Commit documentation
```

### One Thing Per Session
Don't let scope creep. If you came to fix images, fix images.
Write down other ideas for later, don't chase them.

---

## 6. The Ideas Capture System

Create `/ideas.md` command:
```markdown
The user has an idea. Capture it without derailing current work:
1. Add the idea to docs/IDEAS-BACKLOG.md with today's date
2. Do NOT start working on it
3. Do NOT research it
4. Just capture and continue current task
```

Your 50 ideas become 100, become 500. Capture them, don't chase them.

---

## 7. Multi-Project Setup

When you have multiple apps:
```
~/projects/
  ├── promptflow/
  │   ├── CLAUDE.md (project-specific)
  │   └── .claude/commands/ (project-specific)
  ├── app-idea-2/
  │   ├── CLAUDE.md
  │   └── .claude/commands/
  └── ~/.claude/
      └── commands/ (global commands that work everywhere)
```

Global commands: `/debrief`, `/ideas`, `/start`
Project commands: `/test-images`, `/deploy`

---

## 8. The Professional Workflow

```
Morning:
  └── Pick ONE project
  └── Pick ONE task
  └── /start
  └── Execute
  └── /debrief
  └── Done

Afternoon:
  └── Same project OR different project
  └── ONE task
  └── /start → Execute → /debrief

Ideas pop up:
  └── /ideas "the idea"
  └── Back to work

End of day:
  └── Review IDEAS-BACKLOG.md
  └── Prioritize for tomorrow
```

---

## 9. When Things Break

### The Recovery Checklist
```markdown
1. Don't panic
2. `git diff` - what changed?
3. `git log --oneline -5` - when did it break?
4. `git stash` - save current changes
5. `git checkout [last-working-tag]` - go back to working state
6. Compare: what's different?
7. Fix properly this time
```

### The "It Was Working Yesterday" Protocol
```bash
git log --oneline --since="yesterday"
git diff HEAD~5  # see last 5 commits of changes
```

---

## 10. Scaling to 50 Apps

### Template Repository
Once PromptFlow is solid, create a template:
- Base project structure
- CLAUDE.md template
- Blueprint page template
- Common commands

New app = clone template + customize.

### The Build Checklist
For each new app:
- [ ] CLAUDE.md written before first line of code
- [ ] Blueprint page from day 1
- [ ] /debrief used every session
- [ ] Git tags for working milestones
- [ ] IDEAS-BACKLOG.md for scope creep

---

## Summary: Your Daily Toolkit

| Command | When | What It Does |
|---------|------|--------------|
| `/start` | Beginning | Orient yourself |
| `/status` | Anytime | Quick health check |
| `/ideas` | When distracted | Capture without chasing |
| `/test-images` | After image work | Verify pipeline |
| `/debrief` | End of session | Document your work |

The difference between amateur and professional:
- Amateur: Codes until tired, forgets what they did
- Professional: Orient → Execute → Debrief, every single time
