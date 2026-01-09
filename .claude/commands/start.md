You are starting a new session on this project. Before doing ANY coding work:

## Step 1: Read Project Context
Read the CLAUDE.md file in the project root (if it exists) to understand:
- What this project is
- Critical rules that must not be violated
- Current state and what was last worked on

## Step 2: Read the Blueprint
Open More > Blueprint in the app (or read `src/pages/BlueprintPage.tsx`) to understand:
- Image flow pipeline
- Push All to WP sequence
- Data sources and relationships
- Golden rules

## Step 3: Check Current State
Run `git status` and `git log --oneline -5` to see:
- Any uncommitted changes from last session
- Recent commit history

## Step 4: Ask What To Work On
Ask the user: "What would you like to work on this session?"

Do NOT start coding until you have completed these steps. Understanding the system first prevents breaking things that already work.
