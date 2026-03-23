import { Briefcase, Copy, Pencil, Trash2, Users, X, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CodeBlock } from '../components/CodeBlock';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { SigningSecretPanel } from '../components/SigningSecretPanel';
import { SkeletonRow } from '../components/SkeletonRow';
import { Tabs } from '../components/Tabs';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { formatRelative } from '../utils/time';

interface Pipeline {
  id: string;
  sourceId: string;
  name: string;
  description?: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  subscribers: Array<{ id?: string; url: string }> | number;
  createdAt: string;
}

interface Job {
  id: string;
  status: string;
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
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [jobs, setJobs] = useState<PaginatedResponse<Job> | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [activeTab, setActiveTab] = useState('overview');

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

  useEffect(() => {
    fetchPipeline();
  }, [id, apiFetch]);

  useEffect(() => {
    fetchJobs(page);
  }, [id, page, apiFetch]);

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

  const copySourceUrl = () => {
    if (!pipeline) return;
    let webhookUrl = `${window.location.origin}/webhooks/${pipeline.sourceId}`;
    if (window.location.origin.includes('5173')) {
      webhookUrl = `http://localhost:3000/webhooks/${pipeline.sourceId}`;
    }
    navigator.clipboard.writeText(webhookUrl);
    addToast('Webhook URL copied', 'success');
  };

  const startEdit = () => {
    if (!pipeline) return;
    setEditName(pipeline.name);
    setEditDescription(pipeline.description ?? '');
    setEditNameError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditNameError(null);
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setEditNameError('Pipeline name is required');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await apiFetch<Pipeline>(`/pipelines/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: editName.trim(), description: editDescription.trim() || undefined }),
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

  const subscriberUrls = Array.isArray(pipeline.subscribers)
    ? pipeline.subscribers.map((s) => s.url)
    : [];

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
                <Button variant="secondary" size="sm" onClick={copySourceUrl}>
                  <Copy size={14} />
                  Copy Webhook URL
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
          <CodeBlock code={JSON.stringify(pipeline.actionConfig, null, 2)} />
        )}

        {/* Subscribers tab */}
        {activeTab === 'subscribers' && (
          <>
            {subscriberUrls.length === 0 ? (
              <EmptyState
                icon={Users}
                heading="No subscribers"
                body="Add subscriber URLs when creating or editing the pipeline."
              />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {subscriberUrls.map((url, i) => (
                  <div key={i} className="px-5 py-3 text-sm text-gray-800 font-mono">
                    {url}
                  </div>
                ))}
              </div>
            )}
          </>
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    <SkeletonRow columns={4} />
                    <SkeletonRow columns={4} />
                    <SkeletonRow columns={4} />
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
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {jobs.items.map((job) => (
                      <tr key={job.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-3 text-sm">
                          <Badge variant={job.status} />
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
