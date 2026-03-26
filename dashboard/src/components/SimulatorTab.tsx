import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { CodeEditorInput } from './CodeEditorInput';

interface SimulatorTabProps {
  pipelineId: string;
}

interface ResponseState {
  status: number;
  message: string;
  jobId?: string;
}

interface Template {
  key: string;
  label: string;
  payload: Record<string, unknown>;
}

const TEMPLATES: Template[] = [
  {
    key: 'github_push',
    label: 'GitHub — push',
    payload: {
      ref: 'refs/heads/main',
      repository: { full_name: 'owner/repo', name: 'repo' },
      pusher: { name: 'developer' },
      commits: [{ id: 'abc123', message: 'feat: add feature', author: { name: 'developer' } }],
      head_commit: { id: 'abc123', message: 'feat: add feature' },
    },
  },
  {
    key: 'github_pull_request',
    label: 'GitHub — pull_request opened',
    payload: {
      action: 'opened',
      number: 42,
      pull_request: {
        title: 'feat: add feature',
        state: 'open',
        user: { login: 'developer' },
        head: { ref: 'feat/my-feature' },
        base: { ref: 'main' },
      },
      repository: { full_name: 'owner/repo' },
    },
  },
  {
    key: 'github_release',
    label: 'GitHub — release published',
    payload: {
      action: 'published',
      release: {
        tag_name: 'v1.0.0',
        name: 'Release v1.0.0',
        draft: false,
        prerelease: false,
        author: { login: 'developer' },
      },
      repository: { full_name: 'owner/repo' },
    },
  },
  {
    key: 'stripe_charge_succeeded',
    label: 'Stripe — charge.succeeded',
    payload: {
      type: 'charge.succeeded',
      data: {
        object: { id: 'ch_demo', amount: 4999, currency: 'usd', customer: 'cus_demo', status: 'succeeded' },
      },
    },
  },
  {
    key: 'stripe_payment_intent_created',
    label: 'Stripe — payment_intent.created',
    payload: {
      type: 'payment_intent.created',
      data: {
        object: { id: 'pi_demo', amount: 2000, currency: 'usd', status: 'requires_payment_method', customer: 'cus_demo' },
      },
    },
  },
  {
    key: 'custom_blank',
    label: 'Custom (blank)',
    payload: {},
  },
];

function toEditorValue(payload: Record<string, unknown>): string {
  return JSON.stringify(payload, null, 2);
}

export function SimulatorTab({ pipelineId }: SimulatorTabProps) {
  const { apiKey } = useAuth();
  const [selectedKey, setSelectedKey] = useState(TEMPLATES[0].key);
  const [editorValue, setEditorValue] = useState(toEditorValue(TEMPLATES[0].payload));
  const [isValidJson, setIsValidJson] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [responseState, setResponseState] = useState<ResponseState | null>(null);

  const handleEditorChange = (value: string) => {
    setEditorValue(value);
    try {
      JSON.parse(value);
      setIsValidJson(true);
    } catch {
      setIsValidJson(false);
    }
  };

  const handleTemplateChange = (newKey: string) => {
    const currentTemplate = TEMPLATES.find((t) => t.key === selectedKey)!;
    const isDirty = editorValue !== toEditorValue(currentTemplate.payload);

    if (isDirty && !window.confirm('Reset editor to new template? Your edits will be lost.')) {
      return;
    }

    const newTemplate = TEMPLATES.find((t) => t.key === newKey)!;
    setSelectedKey(newKey);
    setEditorValue(toEditorValue(newTemplate.payload));
    setIsValidJson(true);
    setResponseState(null);
  };

  const handleFire = async () => {
    setIsLoading(true);
    setResponseState(null);
    try {
      const response = await fetch(`/pipelines/${pipelineId}/fire-simulation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({ payload: JSON.parse(editorValue) }),
      });

      const body = await response.json();

      if (response.ok) {
        setResponseState({
          status: response.status,
          message: '202 Accepted — job created',
          jobId: body.data?.jobId,
        });
      } else {
        setResponseState({
          status: response.status,
          message: `${response.status} ${response.statusText} — ${body.error?.message ?? 'Request failed'}`,
        });
      }
    } catch (err) {
      setResponseState({
        status: 0,
        message: err instanceof Error ? err.message : 'Network error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Template selector */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Payload Template
        </label>
        <select
          value={selectedKey}
          onChange={(e) => handleTemplateChange(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        >
          {TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Payload editor */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
          Payload
        </label>
        <CodeEditorInput
          value={editorValue}
          onChange={handleEditorChange}
          language="json"
          minRows={10}
          maxRows={30}
          placeholder='{ "key": "value" }'
        />
      </div>

      {/* Fire button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleFire}
          disabled={!isValidJson || isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Firing…' : 'Fire Webhook'}
        </button>
        {!isValidJson && (
          <span className="text-xs text-red-600">Fix invalid JSON before firing</span>
        )}
      </div>

      {/* Response area */}
      {responseState && (
        <div
          className={`rounded-xl border p-4 ${
            responseState.status === 202
              ? 'bg-green-50 border-green-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm font-medium ${
              responseState.status === 202 ? 'text-green-800' : 'text-red-800'
            }`}
          >
            {responseState.message}
          </p>
          {responseState.status === 202 && responseState.jobId && (
            <Link
              to={`/jobs/${responseState.jobId}`}
              className="mt-2 inline-block text-sm text-indigo-600 hover:text-indigo-800 underline"
            >
              View job →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
