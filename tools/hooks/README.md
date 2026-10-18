# House-rule git hooks

**What it is.** Two small git hooks, `commit-msg` and `pre-commit`, that check this repository's commit rules every time you commit. **How it does it:** they are plain shell scripts in a tracked folder; `install.sh` points git at them once per clone.

**Why it exists.** These rules had to be repeated by the owner; a hook checks them every time. Claude Code's own commit reminder asks for a session line, and the `commit-msg` hook is what stops it.

Copyright (c) 2026 LFC Foundry. Released under the MIT License (see `LICENSE` at the top of the repository).

Git does not copy hooks when it clones a repository, so these live in a tracked folder. Turn them on once per clone:

    sh tools/hooks/install.sh

- `commit-msg` blocks a commit whose message has a `Claude-Session:` line or a claude.ai link, or whose author or committer is not `JNFoo <45110762+JNFoo@users.noreply.github.com>`. A `Co-Authored-By` trailer is fine.
- `pre-commit` blocks the wrong author or committer early, and warns (never blocks) about British spellings in added lines. Put `spelling-ok` on a line to silence it.

