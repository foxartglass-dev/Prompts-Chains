# Post-Session Debrief Hook

This is a conceptual file showing how to set up automatic blueprint debriefing.

## In Claude Code CLI - Settings Hooks

Add to your `.claude/settings.json`:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Bash",
        "command": "echo 'Checking if this was a git commit...'"
      }
    ],
    "Stop": [
      {
        "command": "echo '\\n⚠️  DEBRIEF REMINDER: Before ending, update the Blueprint page with your changes!\\nOpen More > Blueprint > Agent Template for the format.\\n'"
      }
    ]
  }
}
```

## Better Approach: Custom Slash Command

Create `.claude/commands/debrief.md`:

```markdown
Before ending this session, document your work:

1. Read the current Blueprint page: src/pages/BlueprintPage.tsx
2. Review what you changed in this session (check git diff or git log)
3. Add your changes to the appropriate Blueprint tab:
   - Data flow changes → ImageFlowDiagram or PushAllDiagram components
   - Source of truth → DataSourcesDiagram component
   - Things that can break → GoldenRules component
4. Follow the Agent Template format (7 sections)
5. Commit your Blueprint updates

This ensures the next agent has context about your work.
```

Then at end of session, user just types: `/debrief`

## The Key Insight

You're right that:
- Agents who BUILD something understand it deeply
- Agents who CHANGE something are the only ones who know what changed
- Studying code is NOT the same as working on it
- Blueprint must be updated BY the agent who made changes, IN THE MOMENT

This is why the debriefing model works - capture knowledge while it's fresh.
