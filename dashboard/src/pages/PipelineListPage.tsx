import { ChevronRight, Clock, Users, Zap } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { CodeEditorInput } from '../components/CodeEditorInput';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { SkeletonCard } from '../components/SkeletonCard';
import { SlideOver } from '../components/SlideOver';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { formatRelative } from '../utils/time';

interface Pipeline {
  id: string;
  name: string;
  actionType: string;
  actionConfig: Record<string, unknown>;
  subscribers: Array<{ url: string }> | number;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function PipelineListPage() {
  const { apiFetch } = useApi();
  const { addToast } = useToast();
  const [data, setData] = useState<PaginatedResponse<Pipeline> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formActionType, setFormActionType] = useState('field_extractor');
  const [formActionConfig, setFormActionConfig] = useState('{}');
  const [formSubscribers, setFormSubscribers] = useState('');
  const [formTeamId, setFormTeamId] = useState('');
  const [formConfigError, setFormConfigError] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  // Teams for the team selector
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    apiFetch<{ items: { id: string; name: string }[] }>('/teams')
      .then((r) => setTeams(r.items))
      .catch(() => setTeams([]));
  }, [apiFetch]);

  const fetchPipelines = async (pageNumber: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<PaginatedResponse<Pipeline>>(`/pipelines?page=${pageNumber}&limit=20`);
      setData(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load pipelines');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelines(page);
  }, [page, apiFetch]);

  const closeAndReset = () => {
    setShowCreateForm(false);
    setFormName('');
    setFormActionType('field_extractor');
    setFormActionConfig('{}');
    setFormSubscribers('');
    setFormTeamId('');
    setFormConfigError(null);
  };

  const validateConfig = (value: string): boolean => {
    try {
      JSON.parse(value);
      setFormConfigError(null);
      return true;
    } catch {
      setFormConfigError('Invalid JSON — please check your config');
      return false;
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateConfig(formActionConfig)) return;

    setFormLoading(true);
    const subscriberUrls = formSubscribers
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    try {
      await apiFetch('/pipelines', {
        method: 'POST',
        body: JSON.stringify({
          name: formName,
          actionType: formActionType,
          actionConfig: JSON.parse(formActionConfig),
          subscriberUrls,
          ...(formTeamId ? { teamId: formTeamId } : {}),
        }),
      });
      closeAndReset();
      addToast('Pipeline created', 'success');
      fetchPipelines(page);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create pipeline', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const subscriberCount = (p: Pipeline) =>
    Array.isArray(p.subscribers) ? p.subscribers.length : (p.subscribers ?? 0);

  return (
    <div>
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pipelines</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your webhook pipelines and routing rules.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setShowCreateForm(true)}>New Pipeline</Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Error */}
      {error && !loading && <ErrorState error={error} onRetry={() => fetchPipelines(page)} />}

      {/* Empty state */}
      {!loading && !error && data?.items.length === 0 && (
        <EmptyState
          icon={Zap}
          heading="No pipelines yet"
          body="Create your first pipeline to start routing webhooks."
          action={<Button onClick={() => setShowCreateForm(true)}>New Pipeline</Button>}
        />
      )}

      {/* Card grid */}
      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {data.items.map((pipeline) => (
              <Link
                key={pipeline.id}
                to={`/pipelines/${pipeline.id}`}
                className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 truncate mr-3">{pipeline.name}</h3>
                  <Badge variant={pipeline.actionType} />
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users size={14} />
                    {subscriberCount(pipeline)} subscriber{subscriberCount(pipeline) !== 1 ? 's' : ''}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} />
                    {formatRelative(pipeline.createdAt)}
                  </span>
                </div>
                <div className="mt-3 flex justify-end">
                  <ChevronRight size={16} className="text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
          <div className="mt-6">
            <Pagination
              page={data.page}
              totalPages={Math.ceil(data.total / data.limit) || 1}
              onPageChange={setPage}
            />
          </div>
        </>
      )}

      {/* Create Pipeline Slide-Over */}
      <SlideOver
        open={showCreateForm}
        onClose={closeAndReset}
        title="New Pipeline"
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={closeAndReset}>
              Cancel
            </Button>
            <Button form="create-pipeline-form" type="submit" loading={formLoading}>
              Create Pipeline
            </Button>
          </div>
        }
      >
        <form id="create-pipeline-form" onSubmit={handleCreate} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Type</label>
            <select
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              value={formActionType}
              onChange={(e) => setFormActionType(e.target.value)}
            >
              <option value="field_extractor">Field Extractor</option>
              <option value="payload_filter">Payload Filter</option>
              <option value="http_enricher">HTTP Enricher</option>
            </select>
          </div>

          {teams.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Team <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <select
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                value={formTeamId}
                onChange={(e) => setFormTeamId(e.target.value)}
              >
                <option value="">No team (personal)</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Action Config (JSON)</label>
            <CodeEditorInput
              value={formActionConfig}
              onChange={(v) => {
                setFormActionConfig(v);
                setFormConfigError(null);
              }}
            />
            {formConfigError && (
              <p className="text-xs text-red-600 mt-1">{formConfigError}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subscriber URLs <span className="text-gray-400 font-normal">(one per line)</span>
            </label>
            <textarea
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="https://example.com/webhook"
              value={formSubscribers}
              onChange={(e) => setFormSubscribers(e.target.value)}
            />
          </div>
        </form>
      </SlideOver>
    </div>
  );
}
