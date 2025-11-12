# Agent OS Prompt Prefix

Use this at the start of your prompts to Claude Code to activate Agent OS methodology:

---

## Version 1: Full Context (Recommended)

```markdown
# Development Methodology: Agent OS

I'm using the Agent OS spec-driven development system for this project.

**Reference**: https://buildermethods.com/agent-os

## How to Proceed:

1. **Read the Agent OS standards** from the repository context below
2. **Follow the 3-layer model**: Standards → Product → Spec
3. **Build according to specifications** without deviating from documented patterns
4. **Maintain consistency** with established conventions

---

## STANDARDS LAYER
[Your coding conventions, architecture patterns, tech stack, quality standards]

## PRODUCT LAYER
[Your product vision, target users, core use cases, roadmap]

## SPEC LAYER
[Detailed specification for the current feature/task]

---

## Current Task:
[Your specific request]
```

---

## Version 2: Minimal (For Quick Tasks)

```markdown
Using Agent OS methodology (https://buildermethods.com/agent-os)

**Standards**: [Brief: tech stack, key patterns]
**Product**: [Brief: what we're building, why]
**Spec**: [Current feature requirements]
**Task**: [What to do now]
```

---

## Version 3: Repository-Based

```markdown
# Agent OS Development Session

Reference: https://buildermethods.com/agent-os

**Setup**: This project uses Agent OS spec-driven development.

**Action Required**:
1. Read `.claude/standards/` for coding conventions
2. Read `.claude/product/` for product context
3. Read `.claude/specs/[feature-name].md` for current feature spec
4. Implement according to specs without deviation

**Current Task**: [Your request]
```

---

## Version 4: PRD/Blueprint Integration

```markdown
# Project Development - Agent OS Methodology

I'm providing project context using the Agent OS 3-layer model
(https://buildermethods.com/agent-os)

This ensures you build according to our exact standards and specifications.

---

**STANDARDS**: See `.claude/standards/` OR [inline standards below]

**PRODUCT**: See attached PRD/blueprint OR [inline product context]

**SPEC**: [Feature specification for current work]

---

**Instructions**:
- Follow standards exactly as documented
- Reference product context for decision-making
- Implement spec with zero deviations unless discussed
- Ask clarifying questions if spec is ambiguous
- Suggest improvements but defer to documented standards

**Task**: [Specific implementation request]
```

---

## Tips for Best Results:

1. **Be Complete**: Provide all 3 layers (Standards, Product, Spec) even if brief
2. **Be Specific**: Detailed specs = better implementation
3. **Reference Files**: If you have .claude/ directory, point to it
4. **Stay Consistent**: Use same format across sessions for same project
5. **Update Regularly**: Keep your Agent OS docs current as project evolves

---

## Quick Copy-Paste Template:

```
# Agent OS Session

Ref: https://buildermethods.com/agent-os

STANDARDS: [Tech stack + key patterns + quality bars]

PRODUCT: [What + Why + Who]

SPEC: [Feature requirements + acceptance criteria]

TASK: [Specific request]

Build according to standards. Ask questions if spec is unclear.
```
