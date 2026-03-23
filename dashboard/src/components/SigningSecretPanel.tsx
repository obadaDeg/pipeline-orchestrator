import { Copy, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';

type SecretStatus = 'loading' | 'none' | 'active' | 'revealed';

interface SecretState {
  status: SecretStatus;
  hint: string | null;
  createdAt: string | null;
  secret: string | null;
}

interface SigningSecretStatusResponse {
  active: boolean;
  hint: string | null;
  createdAt: string | null;
}

interface SigningSecretCreateResponse {
  secret: string;
  hint: string;
  createdAt: string;
}

interface SigningSecretPanelProps {
  pipelineId: string;
}

export function SigningSecretPanel({ pipelineId }: SigningSecretPanelProps) {
  const { apiFetch } = useApi();
  const { addToast } = useToast();

  const [state, setState] = useState<SecretState>({
    status: 'loading',
    hint: null,
    createdAt: null,
    secret: null,
  });
  const [isWorking, setIsWorking] = useState(false);
  const [showRotateConfirm, setShowRotateConfirm] = useState(false);
  const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);

  useEffect(() => {
    loadStatus();
    return () => {
      setState((s) => ({ ...s, secret: null }));
    };
  }, [pipelineId]);

  const loadStatus = async () => {
    try {
      const data = await apiFetch<SigningSecretStatusResponse>(
        `/pipelines/${pipelineId}/signing-secret`,
      );
      setState({
        status: data.active ? 'active' : 'none',
        hint: data.hint,
        createdAt: data.createdAt,
        secret: null,
      });
    } catch {
      setState({ status: 'none', hint: null, createdAt: null, secret: null });
    }
  };

  const handleGenerate = async () => {
    setIsWorking(true);
    try {
      const data = await apiFetch<SigningSecretCreateResponse>(
        `/pipelines/${pipelineId}/signing-secret`,
        { method: 'POST' },
      );
      setState({ status: 'revealed', hint: data.hint, createdAt: data.createdAt, secret: data.secret });
      addToast('Signing secret generated', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to generate secret', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const handleRotate = async () => {
    setShowRotateConfirm(false);
    setIsWorking(true);
    try {
      const data = await apiFetch<SigningSecretCreateResponse>(
        `/pipelines/${pipelineId}/signing-secret`,
        { method: 'POST' },
      );
      setState({ status: 'revealed', hint: data.hint, createdAt: data.createdAt, secret: data.secret });
      addToast('Signing secret rotated', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to rotate secret', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const handleRevoke = async () => {
    setShowRevokeConfirm(false);
    setIsWorking(true);
    try {
      await apiFetch(`/pipelines/${pipelineId}/signing-secret`, { method: 'DELETE' });
      setState({ status: 'none', hint: null, createdAt: null, secret: null });
      addToast('Signing secret revoked', 'success');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to revoke secret', 'error');
    } finally {
      setIsWorking(false);
    }
  };

  const copySecret = () => {
    if (!state.secret) return;
    navigator.clipboard.writeText(state.secret);
    addToast('Secret copied to clipboard', 'success');
  };

  if (state.status === 'loading') {
    return <div className="animate-pulse h-24 bg-gray-100 rounded-xl" />;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <Shield size={20} className="text-indigo-600" />
        <h3 className="text-base font-semibold text-gray-900">Signing Secret</h3>
      </div>

      {state.status === 'none' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Generate a secret to verify webhook authenticity using HMAC-SHA256 signatures.
          </p>
          <Button onClick={handleGenerate} loading={isWorking}>
            Generate Secret
          </Button>
        </div>
      )}

      {state.status === 'revealed' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm font-medium text-amber-800">
              This is the only time this secret will be shown. Copy it now.
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Secret</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={state.secret ?? ''}
                className="flex-1 font-mono text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2"
              />
              <Button variant="secondary" size="sm" onClick={copySecret}>
                <Copy size={14} />
                Copy
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-400">Hint: {state.hint}</p>
          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRotateConfirm(true)}
              loading={isWorking}
            >
              <RefreshCw size={14} />
              Rotate
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowRevokeConfirm(true)}
              loading={isWorking}
            >
              <Trash2 size={14} />
              Revoke
            </Button>
          </div>
        </div>
      )}

      {state.status === 'active' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center text-xs font-medium bg-green-50 text-green-700 px-2 py-1 rounded-full">
              Active
            </span>
            {state.hint && (
              <span className="text-xs text-gray-400">Hint: {state.hint}</span>
            )}
          </div>
          {state.createdAt && (
            <p className="text-xs text-gray-400">
              Created {new Date(state.createdAt).toLocaleString()}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowRotateConfirm(true)}
              loading={isWorking}
            >
              <RefreshCw size={14} />
              Rotate
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowRevokeConfirm(true)}
              loading={isWorking}
            >
              <Trash2 size={14} />
              Revoke
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={showRotateConfirm}
        title="Rotate Signing Secret"
        message="Rotating the secret will immediately invalidate the current one. Any services using the old secret will fail verification. Continue?"
        confirmLabel="Rotate"
        onConfirm={handleRotate}
        onCancel={() => setShowRotateConfirm(false)}
        loading={isWorking}
      />
      <ConfirmDialog
        open={showRevokeConfirm}
        title="Revoke Signing Secret"
        message="Revoking the secret will disable signature verification for all incoming webhooks. Continue?"
        confirmLabel="Revoke"
        onConfirm={handleRevoke}
        onCancel={() => setShowRevokeConfirm(false)}
        loading={isWorking}
      />
    </div>
  );
}
