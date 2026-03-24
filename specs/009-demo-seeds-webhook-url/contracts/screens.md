# UI Screen Contracts: Demo Seed Data & Webhook Inbound URL

## Modified Screen: PipelineDetailPage — Overview Tab

### New Element: Webhook URL Row

**Location**: Overview tab, below the pipeline name/description section, above the Action Config section.

**Layout**:
```
Webhook URL    [https://example.com/api/webhooks/550e8400-...]   [Copy]
```

**Behaviour**:
- URL text is non-editable (read-only display).
- `[Copy]` button calls `navigator.clipboard.writeText(pipeline.sourceUrl)`.
- On successful copy: button label changes to "Copied!" for 2 seconds, then reverts to "Copy".
- If `pipeline.sourceUrl` is falsy: show placeholder text "—" and disable the Copy button.

**Data source**: `pipeline.sourceUrl` from the existing `GET /pipelines/:id` response.

**No new API calls** — data already available from the pipeline fetch on page load.

---

## New Command: Seed CLI

Not a UI screen — documented here as a developer-facing interface contract.

### Command

```
npm run db:seed
```

### Stdout contract

```
[seed] Seeding demo data...
[seed] User:     demo@example.com (created | skipped)
[seed] User:     member@example.com (created | skipped)
[seed] Team:     Acme Platform (created | skipped)
[seed] Team:     Acme Data (created | skipped)
[seed] Pipeline: GitHub Events (created | skipped)
[seed] Pipeline: Stripe Payments (created | skipped)
[seed] Pipeline: Slack Alerts (created | skipped)
[seed] Jobs:     12 created (or N skipped)
[seed] Done.
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | Seed completed successfully (all created or all skipped) |
| 1 | Unrecoverable error (DB connection failure, constraint violation) |
