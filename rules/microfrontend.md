<!-- stack-rules: microfrontend · main copy: projects/prompts/rules/microfrontend.md -->

# Microfrontend conventions

True of **all** my microfrontend apps, not of any one of them. It's written for Module Federation, where apps
share dependencies at runtime. A mistake in one app surfaces in another.

`claude-rules add-app` points each federated app's `CLAUDE.local.md` at it, never `projects/CLAUDE.md`. Not every
app there is a microfrontend, and these rules cost attention on the ones that aren't.

These apply when editing existing code too, not only when creating it. That's why they're rules, not a skill.
See [CONTRIBUTING.md](../CONTRIBUTING.md#the-stack-files) before adding anything.

---

## Nothing escapes this app

- **Every class this app defines carries the app's prefix**, or is scoped by CSS modules. No unprefixed global
  selectors, no styling bare element tags, no `!important` to beat the host.
- **No resets, and no `html` / `body` / `*` rules.** The host owns those. A reset here reformats every other app
  on the page.
- **Nothing on `window`, and no singleton outside this app's module.** State shared with the host goes through the
  declared contract. If you change that contract, name the contract file and say who else reads it.

## Sharing without collisions

- **Test ids carry the app's name.** A host-level end-to-end test has two apps' buttons on one page and no other way
  to tell them apart.
- **User-visible text goes through this app's own i18n namespace**, never the shared default. Two apps writing the
  same key into one namespace silently overwrite each other, and the loser depends on load order.
- **Don't mount a second router, query client, or i18n instance** if the host provides one. Two routers fight over
  the URL and the symptom appears as random navigation.

## Shared packages

- **Imports go one direction only.** A shared package never imports from an app.
- **Changing a shared package is a decision to flag**, not a step to carry out quietly. Say which apps consume it and
  what breaks in each.
- **Anything added to a shared contract needs a default.** Consumers are on their own federated builds and won't all
  be rebuilt with you. A required new field breaks whoever deploys last.
