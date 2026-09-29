# WORK-START Integration (Repo Template)

This repo is integrated with the WORK-START orchestration workflow.

## Local Working Notes (Untracked)
- Path: `.workstart-local/session-notes.md`
- Status: local-only, never committed.
- Purpose: capture short-lived execution planning and validation notes.

## Required Session Note Fields
- Session Start (local + UTC)
- Objective
- Planned edits
- Validation plan
- Outcome
- Promoted records
- Session End (local + UTC)
- Next step

## Promotion Rules
Promote durable outcomes from local notes into tracked records:
- Repo operating rules -> repo `docs/*` and/or repo `AGENTS.md`
- Cross-repo workflow/process decisions -> `WORK-START/logs/decisions.md`
- Follow-up work -> `WORK-START/tasks/*.md`
- Session continuity -> `WORK-START/logs/journal.md`

## Reference
- `/home/user/WORK-START/docs/repo-integration-standard.md`
- `/home/user/WORK-START/templates/local-session-note.md`
