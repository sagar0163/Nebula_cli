# WAR ROOM PLAN — Issue #41: Team Memory Features

Prior attempt completed the team-memory feature implementation but the branch
is stale: it forked from `adb9afa` while `main` has moved forward with 6 new
feature commits (safety #47, docs #51, instant mode #53, community #54,
taxonomy/healing #55, plugins #56). As-is, the PR diff against main would show
~3900 spurious deletions. Remaining work is to sync the branch with main,
verify everything, and ship.

## Remaining subtasks

- [ ] Baseline: run tests + lint on current branch state
- [ ] Merge `main` into `war-room-issue-41`
- [ ] Resolve merge conflicts (src/index.js, advanced-session.js, session.js, functional.test.js, ...)
- [ ] Verify team-memory integration points survived the merge (index.js, namespaced-memory.js, session commands)
- [ ] Re-run tests + lint + type-check after merge
- [ ] Remove plan file and make final commit
- [ ] Push branch to origin