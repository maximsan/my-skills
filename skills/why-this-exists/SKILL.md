---
name: why-this-exists
description: This skill should be used when the user asks "can I remove this", when code is about to be deleted or replaced, when a comment is about to change, or when a reviewed diff does either. Finds out why the code or comment exists first: Chesterton's fence.
---

# Why does this code exist?

Code that looks pointless is often a fix. Someone hit a bug, added a guard, and moved on. Delete it and the bug comes
back — usually silently, and usually not on the machine used for testing.

Treat such code as Chesterton's fence: find out why it was put up before taking it down.

**First: is this even someone else's code?** Check the diff against the base commit. If the block shows up as an
addition, it was written during this task. Its reason is already known. If the approach has since changed, delete
it without any of what follows. This skill is for code that was already in the repo. Applying it to this task's
own abandoned attempts just protects dead code.

For everything else, work down this list. Stop at the first step that gives the answer.

---

## 1. Does a test cover it?

Comment the block out, run the tests, then restore the block exactly as it was.

A failure gives the reason in seconds, and it works no matter what the commit history looks like. This is both the
cheapest check and the most reliable, so do it first.

If a test fails, read what it asserts. That assertion *is* the reason the code exists. It's written down in the
working tree, so there's no need to dig through history for it.

**If nothing fails, that raises the risk rather than lowering it.** It means the behavior is undefended: nothing will
flag it when it breaks. Keep going down this list.

## 2. Does the code look oddly specific?

General design doesn't produce arbitrary specific conditions. Something like:

```js
if (status === 409 && attempt === 0) { ... }
```

is almost always a response to a real incident. So are: a magic number, a named exception for one case, a retry count,
a timeout that isn't a round number, an `if` that excludes one particular value.

Check for a comment nearby too. Also check the surrounding function's other branches. A lone special case among
general ones is a patch.

## 3. What does the history say?

```
git log -L 34,48:src/auth/useLogin.ts   history of just those lines
git log -S'attempt === 0' --oneline     when that exact string first appeared, even if the code moved file
git show <sha>                          the full message — `--oneline` shows only the subject and hides the body
```

Reach for `git log -S` when `-L` comes back thin. It finds the commit that introduced a distinctive string anywhere
in the repo. So it still works after the code is moved or the file is renamed.

Signs it's load-bearing:

- the message mentions a fix, bug, regression, incident, hotfix, or a ticket number
- a test was added or changed in the same commit
- the lines are newer than the code around them — patched in afterwards
- the commit is small and surgical rather than part of a broad change

## 4. When the trail ends in a squashed commit

A squash usually keeps the original commit messages in its body, and names the pull request in its subject.
`git show <sha>` prints all of that. `--oneline` and the GitHub commit list do not.

If `gh` is available, `gh pr view <number>` gets the description and discussion, which is often where the actual
reason was written down.

If none of that yields anything: **the reason is unknown, not absent.** A squashed history is unverified, not
innocent.

---

## Comments: the same ladder, minus its first rung

All of this applies to a comment too. It's the harder case, because **rung 1 doesn't exist.** No test covers a
comment. Nothing fails when one is destroyed, and nothing goes red in review. The loss surfaces months later, when
somebody reintroduces the bug it warned about. Go straight to rung 3 — `git log -L` over its lines, or `git log -S`
on a distinctive phrase from it.

**The failure to avoid is quieter than deletion.** The code changes, the comment now reads as stale, and it gets
updated to describe what the code does now. That looks like tidiness, and it's how the warning disappears. A
comment that contradicts the change is evidence *about the change*. Read it and account for it before
overwriting it. Sometimes it's saying the change is wrong.

**Which comments are load-bearing.** The test is whether it says *why* rather than *what*:

| Regenerable — safe to update | Load-bearing — establish why first |
|---|---|
| Restates what the line does | Names a bug, ticket, incident, or CVE |
| Describes a parameter the signature already shows | Names a browser, version, device, or vendor quirk |
| A heading over an obvious block | Says "don't", "must", "order matters", or explains a non-obvious ordering |
| | Explains a workaround, or why the obvious approach wasn't used |

Treat anything in the right column like load-bearing code. Keep it. If the change makes it genuinely wrong, say
what it used to warn about and why that can't recur. **Rewriting a `why` comment into a `what`
comment is a deletion**, whatever the diff looks like.

---

## What to do with the answer

Say what was found before changing anything: what the code does, when it arrived, and why.

| What was found | What to do |
|---|---|
| A test covers it | Keep it, or change the test deliberately and say why |
| Commit mentions a fix, bug, or ticket | Keep it, unless there's a clear explanation of why the original problem can't recur. Write that explanation where the removal is recorded: `plan.md`, `progress.md` or the review |
| Clearly dead — nothing calls it, nothing tests it, history is innocuous | Remove it, and say what was checked |
| **Can't tell** | **Keep it and ask.** Don't remove it quietly |

The default on "unknown" is keep. That will occasionally leave genuinely dead code in place. That's the right trade.
A stale line costs almost nothing. A resurrected bug costs a day and reaches production first.

## When reviewing someone else's diff

Run the same ladder in reverse on each deleted or rewritten block, reworded comments included. For a reworded
comment, read the old text, not only the new.

- Does the diff also delete or weaken a test that covered it? That's a finding on its own. A removed test is often the
  only surviving record of why the code existed.
- Does the commit that introduced it mention a fix, bug, regression, or ticket? Then removing it is a finding,
  whatever the plan said.
- If it can't be traced, report the removal as **unverified** rather than accepted.
