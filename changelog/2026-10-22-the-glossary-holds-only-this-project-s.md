## 2026-10-22 — The glossary holds only this project's terms

The merged glossary kept every entry from both old glossaries, so most of it defined general terms: git, npm,
PowerShell, and the words used inside the tool's code. A reader looking up a project term had to find it among those,
and the general entries repeated what their own docs say better.

It now holds only terms this project uses in its own sense. The tables that explain the tool's output moved into the
user guide, next to the stages that print them. The developer guide already explains its own words where it uses them.

`v2/cli/review/` held the notes for reviewing the pull request that added the setup tool. That pull request is merged,
and it keeps the record, so the folder is gone.
