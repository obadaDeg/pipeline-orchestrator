/**
 * GitHub Webhook Integration Setup
 *
 * Registers a webhook on your GitHub repository that POSTs push, pull_request,
 * and release events to your Pipeline Orchestrator instance.
 *
 * Prerequisites:
 *   - A GitHub Personal Access Token with `admin:repo_hook` scope
 *     (minimum required for webhook management; `repo` also works but grants
 *     broader access than necessary)
 *   - ngrok running and tunnelling localhost:4000
 *   - The target pipeline must have NO inbound signing secret configured
 *     (unsigned mode). GitHub signs with X-Hub-Signature-256 which the
 *     pipeline does not verify — the pipeline's own X-Webhook-Signature
 *     scheme uses a different format (timestamp + body HMAC).
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... \
 *   GITHUB_REPO=owner/repo \
 *   TUNNEL_URL=https://xxxx.ngrok-free.app \
 *   PIPELINE_SOURCE_ID=<uuid> \
 *   node examples/github-integration/setup.mjs
 *
 * Note: WEBHOOK_SECRET is optional. If set, GitHub will sign deliveries with
 * X-Hub-Signature-256, but the pipeline ignores this header and accepts the
 * request in unsigned mode regardless.
 */

const {
  GITHUB_TOKEN,
  GITHUB_REPO,
  TUNNEL_URL,
  PIPELINE_SOURCE_ID,
  WEBHOOK_SECRET,
} = process.env;

// ─── Validate ─────────────────────────────────────────────────────────────────

const missing = ['GITHUB_TOKEN', 'GITHUB_REPO', 'TUNNEL_URL', 'PIPELINE_SOURCE_ID']
  .filter(k => !process.env[k]);

if (missing.length > 0) {
  console.error(`\n  Missing required env vars: ${missing.join(', ')}\n`);
  console.error(`  Usage:`);
  console.error(`    GITHUB_TOKEN=ghp_...`);
  console.error(`    GITHUB_REPO=owner/repo-name`);
  console.error(`    TUNNEL_URL=https://xxxx.ngrok-free.app`);
  console.error(`    PIPELINE_SOURCE_ID=<uuid from pipeline sourceUrl>`);
  console.error(`    WEBHOOK_SECRET=<whsec_... from pipeline signing secret>`);
  console.error(`    node examples/github-integration/setup.mjs\n`);
  process.exit(1);
}

const webhookUrl = `${TUNNEL_URL.replace(/\/$/, '')}/webhooks/${PIPELINE_SOURCE_ID}`;

// ─── Register webhook ─────────────────────────────────────────────────────────

console.log(`\n  Registering GitHub webhook...`);
console.log(`  Repo:        ${GITHUB_REPO}`);
console.log(`  Webhook URL: ${webhookUrl}`);
console.log(`  Events:      push, pull_request, release\n`);

const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/hooks`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  body: JSON.stringify({
    name: 'web',
    active: true,
    events: ['push', 'pull_request', 'release'],
    config: {
      url: webhookUrl,
      content_type: 'json',
      secret: WEBHOOK_SECRET ?? '',
      insecure_ssl: '0',
    },
  }),
});

const data = await res.json();

if (!res.ok) {
  console.error(`  ✗ GitHub API error (${res.status}):`, JSON.stringify(data, null, 2));
  process.exit(1);
}

console.log(`  ✓ Webhook created!`);
console.log(`  Hook ID:     ${data.id}`);
console.log(`  Ping URL:    ${data.ping_url}`);
console.log(`\n  Next steps:`);
console.log(`  1. Push a commit to ${GITHUB_REPO}`);
console.log(`  2. Watch the job appear in the dashboard: http://localhost:5173`);
console.log(`  3. To delete this webhook later:`);
console.log(`     GITHUB_TOKEN=... GITHUB_REPO=${GITHUB_REPO} HOOK_ID=${data.id} node examples/github-integration/delete.mjs\n`);
