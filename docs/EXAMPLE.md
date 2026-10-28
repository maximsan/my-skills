# A worked example

One small bug, start to finish, so you can judge whether the output is worth the process before committing to it.
Abridged, but nothing here is idealised — including the part where the plan turned out to be wrong.

**Total: about 25 minutes**, of which roughly 6 were me reading things.

---

## What I wrote — `investigations/web-shop/ORD-412/task.md`

```markdown
# ORD-412 — checkout shouldn't blank out for users with no saved card

## Description
Users with no saved payment method get a blank page at checkout.

### Steps to Reproduce
1. Log in as a user with no saved cards
2. Add anything to the basket, go to checkout

### Actual Behavior
Blank page. The console shows
TypeError: cannot read properties of undefined (reading 'last4')

### Expected Behavior
The "add a payment method" prompt.

## Done when
- [ ] checkout with no saved card shows the add-payment prompt
- [ ] a test covers the no-card case

## Links
- Ticket: jira/ORD-412

## What I already know
I think it's in the checkout summary component but haven't checked.

## Out of scope
Don't touch the card-adding flow itself.
```

Four minutes to write. Note the last two sections — the guess saved it searching, and "out of scope" is why the plan
didn't grow into a refactor of the payment flow.

## What `/task-investigate` came back with — `findings.md`

```markdown
## Map
CheckoutPage → useSavedCards() → PaymentSummary
src/checkout/CheckoutPage.tsx:41 → src/payments/useSavedCards.ts:18 → src/checkout/PaymentSummary.tsx:12

## What the code does
| Function | Where | What it actually does |
| useSavedCards | src/payments/useSavedCards.ts:18 | Returns `{cards, loading}`. On an empty
  wallet the API returns `[]`, but on a *new* account it returns `null` — two different empty states |
| PaymentSummary | src/checkout/PaymentSummary.tsx:12 | Reads `cards[0].last4` with no guard |

## What could break
useSavedCards is called in 3 places: CheckoutPage.tsx:41, WalletPage.tsx:22, ProfileCards.tsx:8.
WalletPage already guards with `cards?.length`. ProfileCards does not — same bug, not reported yet.

## Open questions
1. BLOCKER — should a new account (null) and an emptied wallet ([]) look the same to the user?
   a) yes, both show the add-payment prompt  ← recommend
   b) no, new accounts get a different onboarding message
```

**This is where it paid for itself.** My guess about the component was right, but the actual cause was two different
empty states from the API — which I'd never have guessed. It also found the same bug in `ProfileCards`, unreported.
I answered `1a` and moved on.

## What `/task-plan` produced — `plan.md`, abridged

```markdown
## Steps
- [ ] Step 1: failing test — PaymentSummary with cards=null
  - Done when: test fails with the reported TypeError, not an import error
- [ ] Step 2: guard in PaymentSummary.tsx, treat null and [] the same (files: src/checkout/PaymentSummary.tsx)
  - Done when: test from step 1 passes
- [ ] Step 3: same guard in ProfileCards.tsx:8 (files: src/checkout/ProfileCards.tsx)
  - Done when: added test for cards=null passes

## Cleanup / rollback
Nothing replaced. Revert = revert the commit.
```

I read this in about a minute. Step 3 was mine to approve — it's technically out of the ticket, but it's the same
one-line guard and leaving a known bug in place made no sense.

## What `/task-implement` added to `progress.md`, below the investigation checklist

```
### Step 1 — failing test for cards=null — done
Proof:     npm test PaymentSummary → 1 failed:
           "TypeError: cannot read properties of null (reading 'last4')"
Learned:   message says null, ticket says undefined — same crash, different path.
           Ticket reporter was on a new account, not an emptied wallet.
Next:      Step 2

### Step 2 — guard in PaymentSummary — done
Files:     src/checkout/PaymentSummary.tsx
Proof:     npm test PaymentSummary → 4 passed
⚠️ Assumed: showing the same prompt for both empty states, per answer 1a
```

The `Learned:` line matters. The plan said the error was `undefined`; the real one was `null`. Small, but a fix
guarding only `undefined` would have passed review and still been broken for new accounts.

## What `/task-review` found — fresh chat

```markdown
## Verdict
Fix one thing first.

## Real problems
1. medium — src/checkout/ProfileCards.tsx:8 — the guard was added but the new test only
   covers cards=[], not cards=null. Took the fix out and the test still passed →
   it isn't a regression test for the reported case.
```

Caught by re-running the test with the fix taken out. The test looked fine and asserted nothing useful.

## What I did with that — the triage

One finding, so this was quick. I marked it **fix now** and sent it back to the chat that built it:

```
/task-implement investigations/web-shop/ORD-412/review.md
```

It fixed only that finding, re-ran the take-the-fix-out check that caught it, and ticked it off in `review.md`. It
didn't re-review anything else — the rest was already clean, and re-confirming it costs the same as the first pass.

Had I disagreed, I'd have marked it **won't fix** with the reason, which gets recorded so the next review doesn't
raise it again. Anything real but not for this ticket goes to **backlog** in `plan.md`.

## What `/task-learn` proposed

```
NOTES.md
  + If a wallet looks empty but the page crashes — source: progress.md Step 1, Learned:
FEEDBACK.md   none — no corrections this task
Proposed rules  none
Dropped:      none — one candidate, and it passed
```

The note it wrote, once I approved it:

```
### If a wallet looks empty but the page crashes
The cards API returns [] for an emptied wallet and null for a new account. Guard for both.
src/payments/useSavedCards.ts → useSavedCards() · source: ORD-412 progress.md Step 1 · 2026-08-10
```

That's the note I'd want in six months. One note from a whole ticket is normal. The `⚠️ Assumed:` line didn't
become a note, because the assumption held, and a decision that held is already visible in the code.

---

## Was it worth it?

For this bug: the investigation found a second occurrence I didn't know about, the review caught a test that proved
nothing, and the whole thing took 25 minutes for a one-line fix I'd have made in 10.

The 15 extra minutes bought a second bug fixed, a regression test that actually regresses, and a note that stops the
next person hitting the same thing. That trade gets better as the bug gets harder — and worse as it gets easier, which
is why `task-investigate` and `task-review` are skippable for small changes.
