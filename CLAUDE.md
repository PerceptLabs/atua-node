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

## Compatibility Engineering

You are building @aspect/atua-node — a WASIX-based Node.js
runtime that runs entirely in a browser tab. Your goal is
maximum Node.js compatibility within browser constraints.

### Tier Targets
- Tier 1 (pure logic, minimal Node APIs): **100%**. Every
  failure is a bug in our code. No exceptions.
- Tier 2 (crypto, vm, Buffer, streams, zlib): **99%+**. The
  only acceptable failures are documented QuickJS behavioral
  differences vs V8. Each must name the specific limitation.
- Tier 3 (http, net, tls, child_process, cluster): **85%+**.
  Prove browser ceiling before accepting a failure.

### Browser Ceiling — The ONLY Acceptable Unsolvable Failures
- Real TCP/UDP socket bind/listen (SO_REUSEPORT)
- Real fork() with copy-on-write memory
- Real POSIX signals (SIGKILL, SIGSTOP)
- Real inotify/kqueue for fs.watch
- V8 code caching (vm.Script.cachedData)
- Real dlopen with arbitrary .so/.dylib loading
- process.stdin from terminal TTY input

Everything not in this list is fixable. If you are about to
mark something as browser ceiling, verify it is in this list.
If not, it is a bug — fix it.

### When a Test Fails
1. Read the actual error message — never "-" or "unknown"
2. Identify which Node API is involved
3. If not browser ceiling → fix it
4. If browser ceiling → document exactly which constraint

### Package Test Harness Rules
- 0/0 is a harness failure. Fix the harness.
- Check .github/workflows/ for real test commands.
- RESULTS.md must run ALL tiers in one invocation.
- Every failure must have actual error text and Node API.

### The Bar
Package tests are ground truth. When a package test fails
and our internal test passes, add the missing internal test
case after fixing the bug.
