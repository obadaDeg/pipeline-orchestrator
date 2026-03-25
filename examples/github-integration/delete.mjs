/**
 * Delete a GitHub webhook by hook ID.
 *
 * Usage:
 *   GITHUB_TOKEN=ghp_... GITHUB_REPO=owner/repo HOOK_ID=123456789 \
 *   node examples/github-integration/delete.mjs
 */

const { GITHUB_TOKEN, GITHUB_REPO, HOOK_ID } = process.env;

if (!GITHUB_TOKEN || !GITHUB_REPO || !HOOK_ID) {
  console.error('  Required: GITHUB_TOKEN, GITHUB_REPO, HOOK_ID');
  process.exit(1);
}

const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/hooks/${HOOK_ID}`, {
  method: 'DELETE',
  headers: {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
});

if (res.status === 204) {
  console.log(`  ✓ Webhook ${HOOK_ID} deleted from ${GITHUB_REPO}`);
} else {
  const data = await res.json();
  console.error(`  ✗ Error (${res.status}):`, data.message);
}
