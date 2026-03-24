import { AlertCircle, CheckCircle2, ChevronLeft, Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge } from '../components/Badge';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { Pagination } from '../components/Pagination';
import { useApi } from '../hooks/useApi';
import { formatRelative } from '../utils/time';
import { formatJson } from '../utils/json';
import { Button } from '../components/Button';

interface Job {
  id: string;
  pipelineId: string;
  status: string;
  rawPayload: string;
  processedPayload: unknown;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

interface DeliveryAttempt {
  id: string;
  outcome: string;
  httpStatus: number | null;
  responseTimeMs: number | null;
  attemptNumber: number;
  responseSnippet: string | null;
  attemptedAt: string;
}

interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

function PayloadViewer({ title, payload }: { title: string; payload: string | unknown }) {
  const [expanded, setExpanded] = useState(false);

  let formatted = typeof payload === 'string' ? payload : formatJson(payload);
  if (!formatted) formatted = '—';

  const isLarge = formatted.length > 10000;
  const displayContent =
    !isLarge || expanded ? formatted : formatted.substring(0, 10000) + '\n… [Truncated for preview]';

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden flex flex-col h-full">
      <div className="bg-gray-50 border-b rounded-t-xl px-4 py-3 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
        {isLarge && (
          <Button variant="secondary" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Show Less' : 'Show Full Payload'}
          </Button>
        )}
      </div>
      <div className="p-4 overflow-auto max-h-[400px]">
        <pre className="text-xs font-mono text-gray-700 whitespace-pre-wrap break-all leading-relaxed">
          {displayContent}
        </pre>
      </div>
    </div>
  );
}

export function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { apiFetch } = useApi();

  const [job, setJob] = useState<Job | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [jobLoading, setJobLoading] = useState(true);

  const [attempts, setAttempts] = useState<PaginatedResponse<DeliveryAttempt> | null>(null);
  const [attemptsError, setAttemptsError] = useState<string | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchJob = async () => {
    setJobLoading(true);
    setJobError(null);
    try {
      const data = await apiFetch<Job>(`/jobs/${id}`);
      setJob(data);
    } catch (err: unknown) {
      setJobError(err instanceof Error ? err.message : 'Failed to load job');
    } finally {
      setJobLoading(false);
    }
  };

  const fetchAttempts = async (pageNum: number) => {
    setAttemptsLoading(true);
    setAttemptsError(null);
    try {
      const data = await apiFetch<PaginatedResponse<DeliveryAttempt>>(
        `/jobs/${id}/delivery-attempts?page=${pageNum}&limit=50`
      );
      setAttempts(data);
    } catch (err: unknown) {
      setAttemptsError(err instanceof Error ? err.message : 'Failed to load delivery attempts');
    } finally {
      setAttemptsLoading(false);
    }
  };

  useEffect(() => {
    fetchJob();
  }, [id, apiFetch]);

  useEffect(() => {
    fetchAttempts(page);
  }, [id, page, apiFetch]);

  const toggleExpanded = (attemptId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(attemptId)) {
        next.delete(attemptId);
      } else {
        next.add(attemptId);
      }
      return next;
    });
  };

  const isFailed = (outcome: string) =>
    outcome === 'FAILED' || outcome === 'failed';

  const formatResponseTime = (ms: number | null): string => {
    if (ms === null) return '—';
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${ms}ms`;
  };

  if (jobLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-4 bg-gray-200 rounded w-48" />
        <div className="bg-white rounded-xl border border-gray-200 p-6 h-40" />
      </div>
    );
  }
  if (jobError) return <ErrorState error={jobError} onRetry={fetchJob} />;
  if (!job) return <ErrorState error="Job not found" />;

  return (
    <div>
      {/* Back link */}
      <Link
        to={job.pipelineId ? `/pipelines/${job.pipelineId}` : '/'}
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft size={16} />
        {job.pipelineId ? 'Back to Pipeline' : 'Back to Pipelines'}
      </Link>

      {/* Job summary card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-xl font-bold text-gray-900 font-mono">{job.id.slice(0, 8)}…</span>
          <Badge variant={job.status} />
        </div>
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock size={14} />
            Received {formatRelative(job.createdAt)}
          </span>
          <span className="flex items-center gap-1">
            <Clock size={14} />
            Updated {formatRelative(job.updatedAt)}
          </span>
        </div>

        {(job.status === 'FAILED' || job.status === 'failed') && job.errorMessage && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Job Processing Failed</p>
              <p className="text-sm text-red-700 mt-0.5">{job.errorMessage}</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <PayloadViewer title="Raw Payload" payload={job.rawPayload} />
          <PayloadViewer title="Processed Payload" payload={job.processedPayload} />
        </div>
      </div>

      {/* Delivery attempts */}
      <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery Attempts</h2>

      {attemptsLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="flex gap-4">
                <div className="h-4 bg-gray-200 rounded w-8" />
                <div className="h-4 bg-gray-200 rounded w-20" />
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {attemptsError && !attemptsLoading && (
        <ErrorState error={attemptsError} onRetry={() => fetchAttempts(page)} />
      )}

      {!attemptsLoading && !attemptsError && attempts?.items.length === 0 && (
        <EmptyState
          icon={CheckCircle2}
          heading="No delivery attempts"
          body={
            job.status === 'PENDING' || job.status === 'PROCESSING'
              ? 'Delivery has not started yet.'
              : 'No deliveries were made for this job.'
          }
        />
      )}

      {!attemptsLoading && !attemptsError && attempts && attempts.items.length > 0 && (
        <>
          <div className="space-y-3">
            {attempts.items.map((attempt) => {
              const failed = isFailed(attempt.outcome);
              const isExpanded = expandedIds.has(attempt.id);

              return (
                <div
                  key={attempt.id}
                  className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                    failed
                      ? 'bg-red-50 border-red-200 border-l-4 border-l-red-400'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => toggleExpanded(attempt.id)}
                >
                  {/* Collapsed row */}
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-500 w-6">#{attempt.attemptNumber}</span>
                    <Badge variant={attempt.outcome} />
                    <span className="text-sm font-mono text-gray-600">
                      {attempt.httpStatus ?? 'N/A'}
                    </span>
                    <span className="text-sm text-gray-500 font-mono">
                      {formatResponseTime(attempt.responseTimeMs)}
                    </span>
                    <span className="text-sm text-gray-400 ml-auto">
                      {formatRelative(attempt.attemptedAt)}
                    </span>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && attempt.responseSnippet && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs font-medium text-gray-500 mb-2">Response</p>
                      <pre className="text-xs font-mono bg-gray-100 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                        {attempt.responseSnippet}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-4">
            <Pagination
              page={attempts.page}
              totalPages={Math.ceil(attempts.total / attempts.limit) || 1}
              onPageChange={setPage}
            />
          </div>
        </>
      )}
    </div>
  );
}
