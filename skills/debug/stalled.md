# When nothing is narrowing

Three checks in a row that didn't rule anything out means the search is wrong, not unlucky. Stop and do one of:

- **Question the weakest established fact.** Re-read the ledger's evidence for each. One of them is probably an
  assumption with a citation.
- **Bisect.** A version that works exists: `git bisect` between it and now. Or halve the input until the symptom
  goes.
- **Ask for what is out of reach** — production logs, real data, a config value. Say exactly what, and which
  hypothesis it decides.
