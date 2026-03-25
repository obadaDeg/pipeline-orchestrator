import { BarChart2, TrendingDown } from 'lucide-react';
import { useEffect, useState } from 'react';
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

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

export function StatsPage() {
  const { apiFetch } = useApi();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Stats>('/stats');
      setStats(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [apiFetch]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stats</h1>
        <p className="text-sm text-gray-500 mt-1">Overview of your pipeline activity.</p>
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

      {error && !loading && <ErrorState error={error} onRetry={fetchStats} />}

      {!loading && !error && stats && (
        <div className="space-y-6">
          {/* Summary metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StatCard label="Total Pipelines" value={String(stats.totalPipelines)} />
            <StatCard label="Jobs Today" value={String(stats.jobsToday)} />
            <StatCard
              label="Success Rate"
              value={stats.successRate !== null ? `${stats.successRate}%` : 'N/A'}
            />
            <StatCard
              label="Avg Delivery Time"
              value={formatDeliveryTime(stats.avgDeliveryMs)}
            />
          </div>

          {/* Top failing pipelines */}
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Top Failing Pipelines</h2>
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
                    <th className="py-3 px-5 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Failed Jobs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {stats.topFailingPipelines.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-5 text-sm text-gray-900">{p.name}</td>
                      <td className="py-3 px-5 text-sm text-right font-semibold text-red-600">{p.failureCount}</td>
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
