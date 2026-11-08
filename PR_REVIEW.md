# Pull Request Review Workflow

## Prepare the Changes
Follow `AGENTS.md` for branch, commit, and repository conventions. Understand the acceptance criteria and inspect existing behavior before implementing focused changes. Trace affected callers, data flows, permissions, and edge cases.

Add or update tests for meaningful behavioral changes; demonstrate bug fixes with a failing regression test before applying the fix. Run relevant tests, lint, type checking, and builds where applicable. Inspect the final diff for defects, secrets, and unrelated changes. Report actual check results and unverified behavior; never claim checks passed unless executed successfully.

## Create the Pull Request
Make focused commits, push the task branch, and open a PR against the appropriate base (normally `master`). Include:
- What changed, why, intended behavior, and acceptance criteria.
- Relevant implementation details and important edge cases.
- Security, authorization, database, and state-lifecycle implications.
- Checks performed and their results, known limitations, and UI screenshots where relevant.
- Relevant same-repository issue references such as `#123`.

Every PR description must contain an `AI Review` section with these fields:

```markdown
## AI Review
- **Recommended reviewer:** Standard or Multipass
- **Reason:** Concise explanation based on change complexity and risk.
- **Status:** Awaiting manual review via n8n
```

Replace `Standard or Multipass` with exactly one reviewer using the selection criteria below, and supply the specific reason. When updating the description after feedback, preserve the reviewer recommendation and change the review status only when verified against the review results and relevant commit snapshot.

Reviewers use the title and description as context and can retrieve up to three explicitly referenced same-repository issues. Include essential requirements in the description; do not rely on external links, attachments, earlier discussions, or prior PR comments being retrieved automatically.

## Select One Reviewer
Use exactly one of these two workflows normally. Choose by complexity and risk, not line count; when uncertain, recommend Multipass.

### Standard Codex Reviewer
Contract: `myteam-review-v1.2`.

Use for minor UI changes, isolated low-risk bug fixes, limited straightforward modifications, and low-risk refactoring. It inspects the exact PR base/head commits, changed files, surrounding code, callers, authorization, models, routes, and existing tests. Findings require evidence, a plausible trigger, and concrete impact. Style preferences, speculative performance concerns, and missing coverage alone are not defects. Uncertain suspicions become questions. Reports include findings, questions, targeted test suggestions, limitations, and a disposition.

### Multipass Codex Reviewer
Contract: `myteam-review-multipass-v0.2`.

Use for significant features or refactoring, interconnected modules, authentication/authorization, financial logic, migrations, persistence, complex state transitions, and security-sensitive changes. Fresh read-only review sessions perform:
1. `discovery_correctness`: callers, contracts, state transitions, boundaries, error handling, and regressions.
2. `discovery_security_data`: authorization, privacy, transactions, concurrency, persistence, and failure paths. Trace persisted invariants through creation, update, reversal, deletion, recreation, cleanup, and retries; examine cascades, replacement writes, audit state, balances, allocations, authorization state, and idempotency where relevant.
3. Conditional `discovery_coverage`: inspect changed files omitted or partially inspected earlier, plus related callers, writers, and lifecycle interactions.
4. `verify_candidates`: independently classify each candidate as `accepted`, `rejected`, `uncertain`, or `duplicate`. Consolidate duplicates, reject unsupported claims, and retain uncertainty as questions rather than verified defects.

The final report includes validated findings, questions, suggested tests, coverage information, and limitations.

## Hand Off for Manual Review
**Never start either reviewer automatically.** The user enters the GitHub PR URL in the selected workflow's n8n chat. After creating the PR, include its link and the same reviewer recommendation and reason from its `AI Review` section in your final response to the user. Instruct the user to trigger it manually, then stop and await results or further instructions.

Standard review publication uses a separate workflow. Multipass is configured with `publish_to_github: true`, subject to snapshot validation and duplicate-comment checks. For either workflow, verify that the review comment actually appeared on GitHub; job completion alone does not establish publication.

Both reviewers inspect source only: they read tests but do not run tests, lint, type checking, builds, or application code; modify files; or access production services. Reports are advisory, not formal GitHub approvals. No findings does not establish correctness or exhaustive coverage.

## Evaluate Feedback
When the user says “Review completed, handle the feedback” or equivalent:
1. Identify the active `moozuk22/MyTeam` PR from the conversation and current branch. If ambiguous, clarify which PR before changing code.
2. Retrieve its latest GitHub conversation comments, submitted reviews, inline review comments, and available review results.
3. Identify Standard or Multipass, confirm successful completion, and verify that results were published. If results have not appeared on GitHub, report that clearly; do not assume the review succeeded.
4. Compare the reviewed base/head commit IDs with the relevant PR snapshot. Distinguish historical reviews and failed jobs from current completed reviews. If the reviewed commit cannot be established, disclose the uncertainty; never treat an older review as verification of newly pushed commits.
5. Extract the disposition, all actionable findings, questions, suggested tests, and limitations before investigating the code.

- `changes_recommended`: investigate supported defects and correct confirmed problems.
- `needs_manual_review`: disclose material uncertainty for human assessment.
- `no_actionable_findings`: no supported actionable defects were reported; correctness is not guaranteed.

For Multipass, examine accepted findings, uncertain candidates, lifecycle issues, and remaining coverage gaps.

For each actionable finding, read the exact feedback and source, verify its trigger and impact, fix confirmed defects, add relevant regression tests, and run applicable checks. Explain rejected or intentionally unaddressed findings. Do not blindly implement suggestions. Questions require clarification or investigation; suggested tests are proposals, not executed checks. Prioritize security, authorization, financial correctness, data integrity, and regressions.

## Correct and Re-review
Stay on the same PR branch throughout corrections. Inspect the final diff and run relevant tests, lint, type checking, and builds where applicable; report results and any checks not run. Commit and push corrections to that same branch. Summarize fixes, rejected or intentionally unaddressed findings with reasons, unresolved questions, and limitations. A review applies to its specific base/head commits; later pushes require fresh evaluation. Recommend another review when necessary, with the user manually triggering the same PR URL in n8n. Seek human guidance if disagreement or uncertainty persists rather than looping indefinitely.

## Ready for Human Approval
Report readiness only after the selected review has completed for the relevant changes, valid findings are addressed, rejected findings are explained, relevant checks pass, and the current diff is inspected. Ensure no unresolved critical security, integrity, or correctness issues remain, and disclose material uncertainty and review limitations. **Do not automatically merge PRs.**
