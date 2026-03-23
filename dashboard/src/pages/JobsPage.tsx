import { Briefcase } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { SkeletonRow } from '../components/SkeletonRow';
import { useApi } from '../hooks/useApi';
import { formatRelative } from '../utils/time';

interface Job {
  id: string;
  pipelineId: string;
  status: string;
  createdAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export function JobsPage() {
  const { apiFetch } = useApi();
  const [data, setData] = useState<PaginatedResponse<Job> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const fetchJobs = async (pageNum: number) => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch<PaginatedResponse<Job>>(`/jobs?page=${pageNum}&limit=20`);
      setData(response);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs(page);
  }, [page, apiFetch]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
        <p className="text-sm text-gray-500 mt-1">Webhook processing jobs and their delivery status.</p>
      </div>

      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Job ID</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Pipeline</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              <SkeletonRow columns={4} />
              <SkeletonRow columns={4} />
              <SkeletonRow columns={4} />
              <SkeletonRow columns={4} />
            </tbody>
          </table>
        </div>
      )}

      {error && !loading && <ErrorState error={error} onRetry={() => fetchJobs(page)} />}

      {!loading && !error && data?.items.length === 0 && (
        <EmptyState
          icon={Briefcase}
          heading="No jobs yet"
          body="Jobs appear here when webhooks are received by a pipeline."
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job ID</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pipeline</th>
                <th className="py-3 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.items.map((job) => (
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
                    <Link to={`/pipelines/${job.pipelineId}`} className="hover:text-gray-900 truncate max-w-xs block">
                      {job.pipelineId.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="py-4 px-3 text-sm text-gray-500">{formatRelative(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination
            page={data.page}
            totalPages={Math.ceil(data.total / data.limit) || 1}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
