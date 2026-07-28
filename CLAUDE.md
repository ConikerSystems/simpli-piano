# Simpli Piano

<!-- SOURCE-POLICY:START -->
## Source of truth: GitHub (master) — managed by Claude Hub

**GitHub is the master for Simpli Piano.** Develop in the cloud (claude.ai/code, or the Claude app on iPhone) — pick this repo and the "Cloud › Claude" environment. Do NOT develop on the Mac.

On the Mac this repo is a **replica**: each session pulls from GitHub first (safe fast-forward) and the local copy is never hand-edited. If it is detached to a pointer, `git clone` to restore a local copy. Databases/data stay local regardless — GitHub holds code only.
<!-- SOURCE-POLICY:END -->

<!-- SYNC-MERGE-POLICY:START -->
## "Sync to GitHub" = merge to `main` (deploy policy)

For any Coniker app where **GitHub is the master**, "sync to GitHub" means the whole relay, not just a push: **commit → push the working branch → merge it into `main` → `main` is the single up-to-date source.** A change parked on an un-merged branch is **not "done"** — don't leave dangling branches for Joe to manage.

- **Claude tests before merging.** Runs/loads the app off the branch in the cloud and verifies the change does what was asked. Joe does not read or review code.
- **Visual/substantial changes:** Claude sends Joe a **preview screenshot** of the running branch and gets an OK before merging (he reviews a picture, not code). Trivial/docs changes merge without a preview.
- **Reversible:** any merged change that misbehaves is reverted immediately (`git revert`) — `main` returns to its prior state, so merging is never a one-way door.
- The working branch/PR stays as the audit trail + rollback point.
- **After merge:** `main` is the current source — the live app/site redeploys where applicable, and the Mac replica picks it up on its next pull.

_(Hub-wide convention — see `WEB_APP_STANDARDS.md` and the universal `CLAUDE.md` workflow in Claude Hub.)_
<!-- SYNC-MERGE-POLICY:END -->
