# claude-rules

A small command-line tool that sets up this repo's Claude rules and skills for you:

- **`claude-rules setup`**, once per computer.
- **`claude-rules add-app <app>`**, once per app.
- **`claude-rules new-task <app> <ticket>`**, once per ticket.
- **`claude-rules doctor`**, any time. It changes nothing.

What each command does is in the [user guide](../docs/cli/user-guide.md).

It always shows what it will change, and asks before changing anything. You can stop it with Ctrl+C at any point,
and running it again is always safe.

## Get started

In the folder that holds your apps:

```bash
git clone <this-repo-url> prompts
cd prompts
npm install -g .
claude-rules
```

That opens a menu. Press Enter to take **Set up this computer**, and say yes when it offers to add an app.

You need Node 18 or newer, and git. This repo has to sit in the same folder as your apps.

## Documentation

| Read this | If you want to… |
|---|---|
| [User guide](../docs/cli/user-guide.md) | use the tool: each command, what its output means, and what to do when something fails |
| [Glossary](../docs/GLOSSARY.md) | look up a term this project uses in its own sense, in plain words |
| [Developer guide](../docs/cli/developer-guide.md) | change the tool: how the code is organised, how to add a command, a step or a stack, and how it's tested |
| [SETUP.md](../docs/SETUP.md) | set up the whole rules-and-skills system, and run your first task |
| [TROUBLESHOOTING.md](../docs/TROUBLESHOOTING.md) | fix something that doesn't work, remove the setup, or set it up without the tool |

What it never does is listed in the user guide, under
[What the tool never does](../docs/cli/user-guide.md#what-the-tool-never-does).
