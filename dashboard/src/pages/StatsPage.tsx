import { BarChart2, ExternalLink, RefreshCw, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { SkeletonCard } from '../components/SkeletonCard';
import { useApi } from '../hooks/useApi';

interface PipelineFailureStat {
  id: string;
  name: string;
  failureCount: number;
}

interface Stats {
  totalPipelines: number;
  jobsToday: number;
  successRate: number | null;
  avgDeliveryMs: number | null;
  topFailingPipelines: PipelineFailureStat[];
}

function formatDeliveryTime(ms: number | null): string {
  if (ms === null) return 'N/A';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function successRateColor(rate: number | null): string {
  if (rate === null) return 'text-gray-900';
  if (rate >= 90) return 'text-green-600';
  if (rate >= 70) return 'text-amber-500';
  return 'text-red-600';
}

function StatCard({
  label,
  value,
  hint,
  valueClassName,
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold ${valueClassName ?? 'text-gray-900'}`}>{value}</p>
      {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function StatsPage() {
  const { apiFetch } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Stats>('/stats');
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [apiFetch]);

  const maxFailures = stats?.topFailingPipelines[0]?.failureCount ?? 1;

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Stats</h1>
          <p className="text-sm text-gray-500 mt-1">Overview of your pipeline activity.</p>
        </div>
        {!loading && (
          <button
            onClick={() => fetchStats(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </div>

      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      )}

      {error && !loading && <ErrorState error={error} onRetry={() => fetchStats()} />}

      {!loading && !error && stats && (
        <div className="space-y-6">
          {/* Summary metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard
              label="Total Pipelines"
              value={String(stats.totalPipelines)}
              hint={stats.totalPipelines === 0 ? 'No pipelines yet' : undefined}
              action={
                stats.totalPipelines > 0 ? (
                  <Link to="/" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                    View all <ExternalLink size={11} />
                  </Link>
                ) : undefined
              }
            />
            <StatCard
              label="Jobs Today"
              value={String(stats.jobsToday)}
              hint={stats.jobsToday === 0 ? 'No webhooks received today' : undefined}
              action={
                stats.jobsToday > 0 ? (
                  <Link to="/jobs" className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1">
                    View jobs <ExternalLink size={11} />
                  </Link>
                ) : undefined
              }
            />
            <StatCard
              label="Success Rate"
              value={stats.successRate !== null ? `${stats.successRate}%` : 'N/A'}
              hint={stats.successRate === null ? 'No completed jobs yet' : undefined}
              valueClassName={successRateColor(stats.successRate)}
            />
            <StatCard
              label="Avg Delivery Time"
              value={formatDeliveryTime(stats.avgDeliveryMs)}
              hint={stats.avgDeliveryMs === null ? 'No delivery data yet' : undefined}
            />
          </div>

          {/* Top failing pipelines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-900">Top Failing Pipelines</h2>
              {stats.topFailingPipelines.length > 0 && (
                <span className="text-xs text-gray-400">{stats.topFailingPipelines.length} pipeline{stats.topFailingPipelines.length !== 1 ? 's' : ''} with failures</span>
              )}
            </div>
            {stats.topFailingPipelines.length === 0 ? (
              <EmptyState
                icon={TrendingDown}
                heading="No failures"
                body="All pipelines are running without failures."
              />
            ) : (
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="py-3 px-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                    <th className="py-3 px-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Failure rate</th>
                    <th className="py-3 px-5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Failed Jobs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {stats.topFailingPipelines.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="py-3 px-5">
                        <Link
                          to={`/pipelines/${p.id}`}
                          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5"
                        >
                          {p.name}
                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                      </td>
                      <td className="py-3 px-5 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-1.5 max-w-[120px]">
                            <div
                              className="bg-red-400 h-1.5 rounded-full"
                              style={{ width: `${(p.failureCount / maxFailures) * 100}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <span className="text-sm font-semibold text-red-600">{p.failureCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {!loading && !error && !stats && (
        <EmptyState
          icon={BarChart2}
          heading="No stats available"
          body="Create a pipeline and send some webhooks to see your stats here."
        />
      )}
    </div>
  );
}
