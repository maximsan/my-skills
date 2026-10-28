# Planned work

What's planned but not built yet, and what it will need. Remove an entry once it ships.

## Skills that edit tickets on GitHub

Skills that create and edit GitHub issues from a task folder. They'll run the GitHub CLI, `gh`, so every computer that
uses them needs it installed and signed in.

### Installing `gh` without admin rights

For a Windows computer where you can't run installers, such as a managed Windows environment. In Git Bash:

```bash
# 1. Find the latest version, e.g. 2.103.3
VERSION=$(curl -sI https://github.com/cli/cli/releases/latest | grep -i '^location:' | sed 's#.*/tag/v##' | tr -d '\r')

# 2. Download the portable zip, and extract it. The zip holds bin/gh.exe
curl -L -o ~/gh.zip "https://github.com/cli/cli/releases/download/v${VERSION}/gh_${VERSION}_windows_amd64.zip"
mkdir -p ~/gh-cli && unzip -o ~/gh.zip -d ~/gh-cli

# 3. Put it on your PATH, now and in every new terminal
export PATH="$HOME/gh-cli/bin:$PATH"
echo 'export PATH="$HOME/gh-cli/bin:$PATH"' >> ~/.bashrc

# 4. Check it, then sign in
gh --version
gh auth login
```

If `unzip` isn't found, extract with the `tar` that comes with Windows: `/c/Windows/System32/tar.exe -xf ~/gh.zip -C
~/gh-cli`.

To update, run the same steps again.

**Don't run `npm install -g gh`.** That npm package is a different tool. It installs its own `gh` command, which can
hide the real GitHub CLI on your PATH.
