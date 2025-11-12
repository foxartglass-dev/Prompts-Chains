# Agent OS Integration Guide for Claude Code (claude.ai/code)

## What is Agent OS?

Agent OS is a **spec-driven development system** that provides structured context to AI coding agents through a 3-layer model:

1. **Standards Layer** — Your team's coding conventions, patterns, and best practices
2. **Product Layer** — The vision, roadmap, and use cases you're building
3. **Specs Layer** — Detailed specifications for upcoming features

**Core Philosophy**: Your coding standards become executable specifications that guide AI agents to build your way, every time—eliminating repetitive prompting and reducing manual corrections.

---

## How to Use Agent OS in Claude Code Web (claude.ai/code)

Unlike VS Code where `.claude` directory files are automatically detected, Claude Code on the web requires you to **explicitly provide context** in your project. Here are the recommended approaches:

### Option 1: Repository-Based Approach (Recommended)

Store your Agent OS files in your repository:

```
your-project/
├── .claude/
│   ├── standards/
│   │   ├── coding-conventions.md
│   │   ├── architecture-patterns.md
│   │   └── security-requirements.md
│   ├── product/
│   │   ├── vision.md
│   │   ├── roadmap.md
│   │   └── use-cases.md
│   └── specs/
│       ├── feature-001-auth.md
│       ├── feature-002-dashboard.md
│       └── [upcoming features]
```

**When starting a session**, reference these files explicitly:
```
"I'm using the Agent OS system. Please read the standards in .claude/standards/,
the product context in .claude/product/, and the feature specs in .claude/specs/
before implementing [specific feature]."
```

### Option 2: Inline Context Approach

For smaller projects or quick sessions, provide the Agent OS context directly in your initial prompt:

```markdown
# Agent OS Context

## STANDARDS
[Your coding conventions, patterns, and practices]

## PRODUCT
[Your vision, roadmap, and use cases]

## SPEC
[Detailed specification for the current feature]

---

Task: [Your specific request]
```

---

## Template: Initial Prompt with Agent OS Context

Use this template when starting a new Claude Code session with Agent OS methodology:

```markdown
# Project: [Project Name]

I'm using the Agent OS spec-driven development system. Below is the structured context for this project:

---

## 📋 STANDARDS LAYER

### Coding Conventions
- **Language**: [e.g., TypeScript, Python, etc.]
- **Style Guide**: [e.g., Airbnb, PEP 8, etc.]
- **Key Patterns**:
  - [Pattern 1: e.g., "Always use functional components in React"]
  - [Pattern 2: e.g., "Follow repository pattern for data access"]
  - [Pattern 3]

### Architecture Standards
- **Architecture Type**: [e.g., Microservices, Monolithic, Serverless]
- **Folder Structure**:
  ```
  [Your preferred structure]
  ```
- **Component Organization**: [How you organize code]

### Quality Standards
- **Testing**: [e.g., "100% coverage for business logic, integration tests for APIs"]
- **Documentation**: [e.g., "JSDoc for all public functions"]
- **Security**: [e.g., "Input validation on all endpoints, no secrets in code"]
- **Performance**: [e.g., "API responses under 200ms"]

### Technology Stack
- **Frontend**: [Framework, libraries]
- **Backend**: [Framework, database, services]
- **DevOps**: [CI/CD, hosting, monitoring]

---

## 🎯 PRODUCT LAYER

### Vision
[What problem does this solve? What's the ultimate goal?]

### Target Users
[Who is this for?]

### Core Use Cases
1. [Use case 1]
2. [Use case 2]
3. [Use case 3]

### Roadmap
- **Phase 1**: [Current phase features]
- **Phase 2**: [Next phase]
- **Future**: [Long-term goals]

---

## 🔧 SPEC LAYER

### Current Feature: [Feature Name]

#### Overview
[Brief description of what this feature does]

#### Requirements
1. [Functional requirement 1]
2. [Functional requirement 2]
3. [Technical requirement 1]

#### User Stories
- As a [user type], I want to [action] so that [benefit]
- As a [user type], I want to [action] so that [benefit]

#### Acceptance Criteria
- [ ] [Criterion 1]
- [ ] [Criterion 2]
- [ ] [Criterion 3]

#### Technical Specification
- **API Endpoints**: [If applicable]
- **Data Models**: [If applicable]
- **Dependencies**: [What needs to exist first]
- **Edge Cases**: [What to handle]

#### Success Metrics
[How do we measure if this worked?]

---

## 🎬 TASK

[Your specific request for this session]

Example: "Implement the user authentication feature as specified above, following our coding standards and architecture patterns. Create the necessary components, API endpoints, and tests."
```

---

## Best Practices for Claude Code Web

### 1. **Start Every Session with Context**
Always provide or reference your Agent OS layers at the start. Claude's memory resets between sessions.

### 2. **Use File References**
If you have Agent OS files in your repo, ask me to read them:
```
"Please read .claude/standards/coding-conventions.md and
.claude/specs/user-auth.md before starting"
```

### 3. **Layer Your Prompts**
- **First message**: Provide Standards + Product context
- **Second message**: Provide Spec + Task
- This helps me build proper mental model before coding

### 4. **Maintain a Living Document**
Keep an `AGENT_OS_CONTEXT.md` file in your project root that you can reference:
```
"I'm using Agent OS. Please review AGENT_OS_CONTEXT.md for standards,
product context, and current specs before implementing the dashboard feature."
```

### 5. **Update Specs as You Build**
After each feature, update your specs to reflect:
- What was built
- What changed from the original plan
- What was learned

---

## Quick Start: Minimal Template

If you want a lightweight version to start:

```markdown
# Agent OS Quick Context

**Standards**: [Tech stack, key patterns, testing approach]

**Product**: [What we're building and why]

**Spec**: [Current feature requirements]

**Task**: [Specific request]
```

---

## Example: Real-World Usage

```markdown
# Project: TaskFlow - Team Task Management App

## STANDARDS
- TypeScript + React + Node.js
- Follow Airbnb style guide
- Functional components with hooks
- Repository pattern for data access
- 80%+ test coverage
- All API responses under 300ms

## PRODUCT
Building a collaborative task management tool for remote teams.
Target: Small teams (5-20 people) who need simple, fast task tracking.
Core value: Simplicity over features.

## SPEC
Feature: Real-time Task Updates
- Users see task changes immediately without refreshing
- Use WebSocket connection for live updates
- Graceful fallback to polling if WebSocket fails
- Display "User X is editing" indicators
- Sync state across all connected clients

## TASK
Implement the WebSocket infrastructure and real-time task update system.
Include error handling, reconnection logic, and tests.
```

---

## Integration with Other Documents

This Agent OS approach works great with:
- **PRDs (Product Requirement Documents)**: Your PRD becomes the Product Layer
- **Technical Specs**: These become the Spec Layer
- **Coding Standards Docs**: These become the Standards Layer

You can mix and match:
```
"I'm using Agent OS methodology.
- STANDARDS: See .claude/standards/
- PRODUCT: See attached PRD.pdf
- SPEC: [Inline spec here]"
```

---

## Advanced: Multi-Feature Sessions

When working on multiple related features:

```markdown
# Agent OS Context

[Standards layer - once]
[Product layer - once]

## Specs Queue
1. **Feature A** (Current): [Spec]
2. **Feature B** (Next): [High-level overview]
3. **Feature C** (Future): [High-level overview]

Start with Feature A. After completion, I'll provide detailed spec for Feature B.
```

---

## Summary

**Agent OS in Claude Code Web** = Explicitly providing structured context in 3 layers

**Best format**:
1. Create `.claude/` directory in your repo with standards, product, and specs
2. OR maintain a single `AGENT_OS_CONTEXT.md` file
3. Reference or paste this context at session start
4. Update as your project evolves

**Result**: Consistent, production-quality code that follows your standards without repetitive prompting.

---

## Getting Started Checklist

- [ ] Choose your approach (repo-based or inline)
- [ ] Document your coding standards
- [ ] Write your product vision and use cases
- [ ] Create your first feature spec
- [ ] Test with a simple implementation task
- [ ] Refine based on results
- [ ] Scale to more features

---

**Ready to use Agent OS?** Start by filling out the template above with your project's context, and I'll build exactly the way you want, every time.
