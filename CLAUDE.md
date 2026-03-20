## Git Workflow — Snapshots

When I say "push", "snapshot", or "checkpoint":

1. `git add -A`
2. `git commit -m "Snapshot: <description>"` — use context from recent work
3. Create snapshot branch using **today's actual date**:
   ```bash
   git branch "snapshot-$(date +%Y-%m-%d)-<short-description>"
   ```
4. Push it:
   ```bash
   git push origin "snapshot-$(date +%Y-%m-%d)-<short-description>"
   ```
5. **Stay on current branch** — do NOT checkout the snapshot
6. Tell me: what was committed, the snapshot branch name, and confirm I'm still on my working branch

These are frozen checkpoints. Never switch to them. Keep working on main.

**Always use `$(date +%Y-%m-%d)` for the date. Never hardcode a date.**
**Use kebab-case for short descriptions** (e.g., `shell-improvements`, not `shell improvements`).

**Example** — if I say "push - shell stuff done":
- Commit: `Snapshot: shell improvements complete`
- Branch: `snapshot-<TODAY>-shell-improvements`
- Push it
- Stay on main

## No Lazy Stubs

- Stubs returning zero/ENOSYS are bugs if user code observes the value via `process.*`/`os.*`/any Node API
- Return `UV_ENOSYS` ONLY when the capability is genuinely handled by a TypeScript bridge (net-bridge, proc-bridge, thread-bridge)
- For POSIX functions wasix-libc declares but doesn't implement, write **real fallback code** (e.g., `readv` → loop over `read()`, `pipe2` → `pipe()` + `fcntl()`)
- Platform query functions must return sensible real values, not zeros

## No Lazy Implementations

- No TODO comments that ship
- No mocking what can be real
- No skipping error handling
- When compilation fails, fix the specific error — don't preemptively stub everything
- Every function either works correctly or returns a documented error for a documented reason
