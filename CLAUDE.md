# Simpli Piano

**At session start:** check git sync, then read **`HANDOFF.md`** for where we left off. **Refresh `HANDOFF.md`** when wrapping up, and sooner if the conversation is getting large (sections: Updated date · where things stand · what we did · unfinished · next steps · how to run/test). It is committed, so it carries context to the next session on the Mac or in the cloud.

## Source of truth: GitHub — one rule for every program

GitHub holds the code. Work wherever suits the task — the Mac, claude.ai/code, or the
Claude app on iPhone — and let the state of the repo decide what happens, not a setting:

- **Session start** fast-forwards this repo when the Mac copy is clean and level with
  GitHub, and **refuses to pull** — naming exactly what is in the way — when it holds
  uncommitted or unpushed work.
- **Session end** commits, runs this repo's test gate (`.claude/source.json` → `"test"`)
  and pushes.

Databases and data stay local on the Mac regardless — GitHub holds code only.

_There used to be a per-app `master` flag here, and a line telling you not to develop on
the Mac. Both went on 2026-09-20: the flag was a string nobody corroborated, while the
sync state is measured from git every session._

<!-- SYNC-MERGE-POLICY:START -->
## "Sync to GitHub" = merge to `main` (deploy policy)

For any Coniker app, "sync to GitHub" means the whole relay, not just a push: **commit → push the working branch → merge it into `main` → `main` is the single up-to-date source.** A change parked on an un-merged branch is **not "done"** — don't leave dangling branches for Joe to manage.

- **Claude tests before merging.** Runs/loads the app off the branch in the cloud and verifies the change does what was asked. Joe does not read or review code.
- **Visual/substantial changes:** Claude sends Joe a **preview screenshot** of the running branch and gets an OK before merging (he reviews a picture, not code). Trivial/docs changes merge without a preview.
- **Reversible:** any merged change that misbehaves is reverted immediately (`git revert`) — `main` returns to its prior state, so merging is never a one-way door.
- The working branch/PR stays as the audit trail + rollback point.
- **After merge:** `main` is the current source — the live app/site redeploys where applicable, and the Mac replica picks it up on its next pull.

_(Hub-wide convention — see `WEB_APP_STANDARDS.md` and the universal `CLAUDE.md` workflow in Claude Hub.)_
<!-- SYNC-MERGE-POLICY:END -->
