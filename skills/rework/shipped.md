# When the reworked code already shipped

- **Every call site**, grepped. The new version serves all of them, or each exception is a decision.
- **Live data** in the old shape — migration, or a reader that handles both.
- **In-flight work**: anything queued, cached, or mid-session when this deploys.
- **Rollback** — and check "revert the commit" is still true after a migration.

Prefer keeping the old interface, or both paths behind a flag, over a single cutover.
