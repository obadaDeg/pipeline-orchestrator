import { Briefcase, Copy, Pencil, RefreshCw, Trash2, X, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CodeBlock } from '../components/CodeBlock';
import { CodeEditorInput } from '../components/CodeEditorInput';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { SigningSecretPanel } from '../components/SigningSecretPanel';
import { SimulatorTab } from '../components/SimulatorTab';
import { SkeletonRow } from '../components/SkeletonRow';
import { Tabs } from '../components/Tabs';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { formatRelative } from '../utils/time';

interface Pipeline {
  id: string;
  sourceId: string;
  sourceUrl: string;
  name: string;
  description?: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  rateLimitPerMinute: number | null;
  subscribers: Array<{ id?: string; url: string }> | number;
  createdAt: string;
}

interface Job {
  id: string;
  status: string;
  retryCount: number;
  rawPayload: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'subscribers', label: 'Subscribers' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'security', label: 'Security' },
  { key: 'simulator', label: 'Simulator' },
];

export function PipelineDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { apiFetch } = useApi();
  const { addToast } = useToast();

  const [pipeline, setPipeline] = useState<Pipeline | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editActionConfig, setEditActionConfig] = useState('');
  const [editRateLimit, setEditRateLimit] = useState('');
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editConfigError, setEditConfigError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [jobs, setJobs] = useState<PaginatedResponse<Job> | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('overview');
  const [isCopied, setIsCopied] = useState(false);

  // Subscriber management state
  const [subscriberDraft, setSubscriberDraft] = useState<string[]>([]);
  const [newSubscriberUrl, setNewSubscriberUrl] = useState('');
  const [newSubscriberError, setNewSubscriberError] = useState<string | null>(null);
  const [isSubscribersSaving, setIsSubscribersSaving] = useState(false);

  const fetchPipeline = async () => {
    setPipelineLoading(true);
    setPipelineError(null);
    try {
      const data = await apiFetch<Pipeline>(`/pipelines/${id}`);
      setPipeline(data);
    } catch (err: unknown) {
      setPipelineError(err instanceof Error ? err.message : 'Failed to load pipeline');
    } finally {
      setPipelineLoading(false);
    }
  };

  const fetchJobs = async (pageNum: number) => {
    setJobsLoading(true);
    setJobsError(null);
    try {
      const data = await apiFetch<PaginatedResponse<Job>>(`/pipelines/${id}/jobs?page=${pageNum}&limit=20`);
      setJobs(data);
    } catch (err: unknown) {
      setJobsError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setJobsLoading(false);
    }
  };

  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId);
    try {
      const updated = await apiFetch<Job>(`/jobs/${jobId}/retry`, { method: 'POST' });
      setJobs((prev) =>
        prev
          ? { ...prev, items: prev.items.map((j) => (j.id === jobId ? { ...j, ...updated } : j)) }
          : prev,
      );
      addToast('Job re-queued for processing', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to retry job', 'error');
    } finally {
      setRetryingJobId(null);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [id, apiFetch]);

  const hasActiveJobs = jobs?.items.some(
    (j) => j.status === 'PENDING' || j.status === 'PROCESSING',
  ) ?? false;

  useEffect(() => {
    if (activeTab !== 'jobs') return;
    fetchJobs(page);
    if (!hasActiveJobs) return;
    const timer = setInterval(() => fetchJobs(page), 3_000);
    return () => clearInterval(timer);
  }, [id, page, apiFetch, activeTab, hasActiveJobs]);

  useEffect(() => {
    if (pipeline) {
      const urls = Array.isArray(pipeline.subscribers)
        ? pipeline.subscribers.map((s) => s.url)
        : [];
      setSubscriberDraft(urls);
    }
  }, [pipeline]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/pipelines/${id}`, { method: 'DELETE' });
      addToast('Pipeline deleted', 'success');
      navigate('/');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to delete pipeline', 'error');
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  };

  const saveSubscriberUrls = async (urls: string[]) => {
    setIsSubscribersSaving(true);
    try {
      const updated = await apiFetch<Pipeline>(`/pipelines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ subscriberUrls: urls }),
      });
      setPipeline(updated);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to save subscribers', 'error');
    } finally {
      setIsSubscribersSaving(false);
    }
  };

  const handleAddSubscriber = () => {
    const url = newSubscriberUrl.trim();
    if (!url) { setNewSubscriberError('URL is required'); return; }
    try { new URL(url); } catch { setNewSubscriberError('Must be a valid URL'); return; }
    if (subscriberDraft.includes(url)) { setNewSubscriberError('Already added'); return; }
    const next = [...subscriberDraft, url];
    setSubscriberDraft(next);
    setNewSubscriberUrl('');
    setNewSubscriberError(null);
    void saveSubscriberUrls(next);
  };

  const handleRemoveSubscriber = (url: string) => {
    const next = subscriberDraft.filter((u) => u !== url);
    setSubscriberDraft(next);
    void saveSubscriberUrls(next);
  };

  const handleCopyWebhookUrl = () => {
    if (!pipeline?.sourceUrl) return;
    navigator.clipboard.writeText(pipeline.sourceUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const startEdit = () => {
    if (!pipeline) return;
    setEditName(pipeline.name);
    setEditDescription(pipeline.description ?? '');
    setEditActionConfig(JSON.stringify(pipeline.actionConfig, null, 2));
    setEditRateLimit(String(pipeline.rateLimitPerMinute ?? 60));
    setEditNameError(null);
    setEditConfigError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditNameError(null);
    setEditConfigError(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setEditNameError('Pipeline name is required');
      return;
    }
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(editActionConfig);
    } catch {
      setEditConfigError('Action config must be valid JSON');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await apiFetch<Pipeline>(`/pipelines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || undefined,
          actionConfig: parsedConfig,
          rateLimitPerMinute: Number(editRateLimit) || null,
        }),
      });
      setPipeline(updated);
      setIsEditing(false);
      addToast('Pipeline updated', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to update pipeline', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (pipelineLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-4 bg-gray-200 rounded w-32" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-40" />
      </div>
    );
  }
  if (pipelineError) return <ErrorState error={pipelineError} onRetry={fetchPipeline} />;
  if (!pipeline) return <ErrorState error="Pipeline not found" />;

  return (
    <div>
      {/* Breadcrumb */}
      <Link to="/" className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
        ← Pipelines
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0 mr-4">
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <input
                    autoFocus
                    type="text"
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setEditNameError(null); }}
                    className="w-full text-2xl font-bold text-gray-900 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Pipeline name"
                  />
                  {editNameError && (
                    <p className="text-xs text-red-600 mt-1">{editNameError}</p>
                  )}
                </div>
                <input
                  type="text"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full text-sm text-gray-500 border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Description (optional)"
                />
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">{pipeline.name}</h1>
                  <Badge variant={pipeline.actionType} />
                </div>
                {pipeline.description && (
                  <p className="text-sm text-gray-600 mt-1">{pipeline.description}</p>
                )}
                <p className="text-sm text-gray-500 mt-1">Created {formatRelative(pipeline.createdAt)}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isEditing ? (
              <>
                <Button variant="secondary" size="sm" onClick={cancelEdit} disabled={isSaving}>
                  <X size={14} />
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSave} loading={isSaving}>
                  <Check size={14} />
                  Save
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" size="sm" onClick={handleCopyWebhookUrl} disabled={!pipeline.sourceUrl}>
                  <Copy size={14} />
                  {isCopied ? 'Copied!' : 'Copy Webhook URL'}
                </Button>
                <Button variant="ghost" size="sm" onClick={startEdit}>
                  <Pencil size={14} />
                  Edit
                </Button>
                <Button variant="danger" size="sm" onClick={() => setShowConfirmDelete(true)}>
                  <Trash2 size={14} />
                  Delete
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs tabs={TABS} activeTab={activeTab} onChange={setActiveTab} />

      <div className="mt-6">
        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Webhook URL</p>
                  {pipeline.sourceUrl ? (
                    <p className="text-sm font-mono text-gray-800 truncate">{pipeline.sourceUrl}</p>
                  ) : (
                    <p className="text-sm text-gray-400">—</p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopyWebhookUrl}
                  disabled={!pipeline.sourceUrl}
                  className="shrink-0"
                >
                  <Copy size={14} />
                  {isCopied ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Rate limit</p>
              {isEditing ? (
                <div>
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    className="block w-48 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    value={editRateLimit}
                    onChange={(e) => setEditRateLimit(e.target.value)}
                  />
                  <p className="text-xs text-gray-400 mt-1">Default: 60. Max: 1000.</p>
                </div>
              ) : (
                <p className="text-sm text-gray-800">
                  {pipeline.rateLimitPerMinute !== null
                    ? `${pipeline.rateLimitPerMinute} req/min`
                    : '60 req/min (default)'}
                </p>
              )}
            </div>
            {isEditing ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Action Config</p>
                <CodeEditorInput
                  value={editActionConfig}
                  onChange={(v) => { setEditActionConfig(v); setEditConfigError(null); }}
                  actionType={pipeline.actionType}
                />
                {editConfigError && (
                  <p className="text-xs text-red-600 mt-1">{editConfigError}</p>
                )}
              </div>
            ) : (
              <CodeBlock code={JSON.stringify(pipeline.actionConfig, null, 2)} />
            )}
          </div>
        )}

        {/* Subscribers tab */}
        {activeTab === 'subscribers' && (
          <div className="space-y-4">
            {/* Current subscribers list */}
            <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {subscriberDraft.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-400">
                  No subscribers yet. Add one below.
                </div>
              ) : (
                subscriberDraft.map((url) => (
                  <div key={url} className="flex items-center justify-between px-5 py-3 gap-3">
                    <span className="text-sm font-mono text-gray-800 truncate">{url}</span>
                    <button
                      onClick={() => handleRemoveSubscriber(url)}
                      className="shrink-0 text-gray-400 hover:text-red-500 transition-colors"
                      title="Remove"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add subscriber input */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Add subscriber URL</p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={newSubscriberUrl}
                  onChange={(e) => { setNewSubscriberUrl(e.target.value); setNewSubscriberError(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSubscriber()}
                  placeholder="https://example.com/webhook"
                  className="flex-1 text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />
                <Button size="sm" variant="secondary" onClick={handleAddSubscriber}>
                  Add
                </Button>
              </div>
              {newSubscriberError && (
                <p className="text-xs text-red-600">{newSubscriberError}</p>
              )}
            </div>

          </div>
        )}

        {/* Jobs tab */}
        {activeTab === 'jobs' && (
          <>
            {jobsLoading && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Payload</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <SkeletonRow columns={5} />
                    <SkeletonRow columns={5} />
                    <SkeletonRow columns={5} />
                  </tbody>
                </table>
              </div>
            )}

            {jobsError && !jobsLoading && (
              <ErrorState error={jobsError} onRetry={() => fetchJobs(page)} />
            )}

            {!jobsLoading && !jobsError && jobs?.items.length === 0 && (
              <EmptyState
                icon={Briefcase}
                heading="No jobs yet"
                body="Jobs will appear here once webhooks are received."
              />
            )}

            {!jobsLoading && !jobsError && jobs && jobs.items.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payload</th>
                      <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {jobs.items.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Badge variant={job.status} />
                            {job.retryCount > 0 && (
                              <span className="text-xs text-gray-400">
                                {job.retryCount} {job.retryCount === 1 ? 'retry' : 'retries'}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-3 text-sm font-mono">
                          <Link to={`/jobs/${job.id}`} className="text-indigo-600 hover:text-indigo-800">
                            {job.id.slice(0, 8)}…
                          </Link>
                        </td>
                        <td className="py-4 px-3 text-sm text-gray-500">
                          {formatRelative(job.createdAt)}
                        </td>
                        <td className="py-4 px-3 text-sm text-gray-500 font-mono truncate max-w-xs">
                          {job.rawPayload?.length > 80
                            ? job.rawPayload.substring(0, 80) + '…'
                            : job.rawPayload}
                        </td>
                        <td className="py-4 px-3 text-sm">
                          {job.status === 'FAILED' && (
                            <Button
                              size="sm"
                              variant="secondary"
                              loading={retryingJobId === job.id}
                              onClick={() => handleRetryJob(job.id)}
                            >
                              <RefreshCw size={12} />
                              Retry
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <Pagination
                  page={jobs.page}
                  totalPages={Math.ceil(jobs.total / jobs.limit) || 1}
                  onPageChange={setPage}
                />
              </div>
            )}
          </>
        )}

        {/* Security tab */}
        {activeTab === 'security' && id && (
          <SigningSecretPanel pipelineId={id} />
        )}

        {/* Simulator tab */}
        {activeTab === 'simulator' && id && (
          <SimulatorTab pipelineId={id} />
        )}
      </div>

      {/* Confirm delete dialog */}
      <ConfirmDialog
        open={showConfirmDelete}
        title="Delete Pipeline"
        message="This will permanently delete the pipeline and all its jobs. This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setShowConfirmDelete(false)}
        loading={isDeleting}
      />
    </div>
  );
}
