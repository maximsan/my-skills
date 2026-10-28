## 2026-10-09 — Short skill descriptions, and the agent still starts every skill

Every skill description loads into every session. Most of their length retold each skill's method or listed
several phrasings of the same request. Each description now has three parts:

- when to load the skill
- the words the user actually says, quoted, with a second phrasing only when it brings a new key word
- the neighbouring skill to use instead, where two overlap

Example: `Triggers on "investigate", "look into this", "check it out"`. The quoted phrases matter most for the task
stages, because the user asks for them in plain words more often than by typing `/task-investigate`.

The agent can start every skill, including the task stages. Making the stages start only by `/name`
(`disable-model-invocation: true`) was considered and rejected: the agent then couldn't act on "investigate this" or
"review this". The two risks it was meant to cover are handled inside the skills:

- `task-implement` starts only after it finds and quotes the user's go-ahead in the chat.
- `task-review` stops if it wrote the code in the same chat.

The cost: the quoted phrases keep the descriptions longer than one line each, in every session.
