import { Copy, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CodeBlock } from '../components/CodeBlock';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { SkeletonRow } from '../components/SkeletonRow';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { formatRelative } from '../utils/time';
import { formatJson } from '../utils/json';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface AuditEvent {
  id: string;
  eventType: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function AccountPage() {
  const { apiFetch } = useApi();
  const { addToast } = useToast();

  // API Keys
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [keysLoading, setKeysLoading] = useState(true);
  const [keysError, setKeysError] = useState<string | null>(null);

  // Create key
  const [newName, setNewName] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  // Revoke
  const [revokingKeyId, setRevokingKeyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const confirmRevokeKey = keys?.find((k) => k.id === confirmRevokeId);

  // Audit log
  const [log, setLog] = useState<PaginatedResponse<AuditEvent> | null>(null);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);
  const [logPage, setLogPage] = useState(1);

  const fetchKeys = async () => {
    setKeysLoading(true);
    setKeysError(null);
    try {
      const data = await apiFetch<ApiKey[]>('/auth/keys');
      setKeys(data);
    } catch (err: unknown) {
      setKeysError(err instanceof Error ? err.message : 'Failed to load keys');
    } finally {
      setKeysLoading(false);
    }
  };

  const fetchLog = async (pageNum: number) => {
    setLogLoading(true);
    setLogError(null);
    try {
      const data = await apiFetch<PaginatedResponse<AuditEvent>>(
        `/auth/audit-log?page=${pageNum}&limit=20`
      );
      setLog(data);
    } catch (err: unknown) {
      setLogError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLogLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, [apiFetch]);

  useEffect(() => {
    fetchLog(logPage);
  }, [logPage, apiFetch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);
    try {
      const data = await apiFetch<{ key: string; keyData: ApiKey }>('/auth/keys', {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
      setNewKey(data.key);
      setNewName('');
      addToast('Key created — save it now!', 'success');
      fetchKeys();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create key', 'error');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!confirmRevokeId) return;
    setRevokingKeyId(confirmRevokeId);
    setConfirmRevokeId(null);
    try {
      await apiFetch(`/auth/keys/${confirmRevokeId}`, { method: 'DELETE' });
      setKeys((prev) => (prev ? prev.filter((k) => k.id !== confirmRevokeId) : null));
      addToast('API key revoked', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke key', 'error');
    } finally {
      setRevokingKeyId(null);
    }
  };

  const copyNewKey = () => {
    if (newKey) {
      navigator.clipboard.writeText(newKey);
      addToast('Key copied', 'success');
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Account</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your API keys and view account activity.</p>
      </div>

      {/* Section 1: API Keys */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Keys used for authenticating with the API.</p>

        {keysLoading && (
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y divide-gray-200">
              <SkeletonRow columns={5} />
              <SkeletonRow columns={5} />
            </tbody>
          </table>
        )}

        {keysError && !keysLoading && <ErrorState error={keysError} onRetry={fetchKeys} />}

        {!keysLoading && !keysError && (!keys || keys.length === 0) && (
          <EmptyState heading="No API keys" body="Create your first key below." />
        )}

        {!keysLoading && !keysError && keys && keys.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefix</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Used</th>
                  <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  <th className="py-3 px-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {keys.map((key) => (
                  <tr key={key.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-3 text-sm font-medium text-gray-900">{key.name}</td>
                    <td className="py-4 px-3 text-sm font-mono text-gray-500">{key.keyPrefix}…</td>
                    <td className="py-4 px-3 text-sm text-gray-500">
                      {key.lastUsedAt ? formatRelative(key.lastUsedAt) : 'Never'}
                    </td>
                    <td className="py-4 px-3 text-sm text-gray-500">{formatRelative(key.createdAt)}</td>
                    <td className="py-4 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRevokeId(key.id)}
                        disabled={revokingKeyId === key.id}
                        loading={revokingKeyId === key.id}
                      >
                        <Trash2 size={14} />
                        Revoke
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Section 2: Create New Key */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Create New Key</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Generate a new API key for authentication.</p>

        <form onSubmit={handleCreate} className="flex gap-3 max-w-sm">
          <input
            type="text"
            required
            placeholder="Key name (e.g. CI/CD)"
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <Button type="submit" loading={createLoading}>
            Create Key
          </Button>
        </form>

        {newKey && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-800 mb-2">
              New key created — copy it now, it won&apos;t be shown again.
            </p>
            <CodeBlock code={newKey} />
            <div className="flex gap-2 mt-3">
              <Button variant="secondary" size="sm" onClick={copyNewKey}>
                <Copy size={14} />
                Copy Key
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setNewKey(null)}>
                Dismiss
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Section 3: Audit Log */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">Recent account activity and security events.</p>

        {logLoading && (
          <table className="min-w-full divide-y divide-gray-200">
            <tbody className="divide-y divide-gray-200">
              <SkeletonRow columns={3} />
              <SkeletonRow columns={3} />
              <SkeletonRow columns={3} />
            </tbody>
          </table>
        )}

        {logError && !logLoading && <ErrorState error={logError} onRetry={() => fetchLog(logPage)} />}

        {!logLoading && !logError && (!log || log.items.length === 0) && (
          <EmptyState heading="No audit events" body="Account activity will appear here." />
        )}

        {!logLoading && !logError && log && log.items.length > 0 && (
          <>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Event</th>
                    <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timestamp</th>
                    <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/2">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {log.items.map((event) => (
                    <tr key={event.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-3 text-sm">
                        <Badge variant={event.eventType} />
                      </td>
                      <td className="py-4 px-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatRelative(event.createdAt)}
                      </td>
                      <td className="py-4 px-3 text-sm text-gray-500">
                        <details className="cursor-pointer group">
                          <summary className="font-medium text-indigo-600 select-none group-hover:text-indigo-800 transition-colors outline-none">
                            View Metadata
                          </summary>
                          <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs font-mono text-gray-700 whitespace-pre-wrap overflow-auto max-h-48">
                            {formatJson(event.metadata)}
                          </pre>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4">
              <Pagination
                page={log.page}
                totalPages={Math.ceil(log.total / log.limit) || 1}
                onPageChange={setLogPage}
              />
            </div>
          </>
        )}
      </section>

      {/* Revoke confirm dialog */}
      <ConfirmDialog
        open={confirmRevokeId !== null}
        title="Revoke API Key"
        message={`Revoke "${confirmRevokeKey?.name ?? 'this key'}"? This cannot be undone.`}
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        onCancel={() => setConfirmRevokeId(null)}
        loading={revokingKeyId !== null}
      />
    </div>
  );
}
