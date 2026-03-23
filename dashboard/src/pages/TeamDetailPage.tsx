import { UserMinus, UserPlus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../components/Button';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorState } from '../components/ErrorState';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';

interface TeamMember {
  userId: string;
  email: string;
  joinedAt: string;
}

interface Team {
  id: string;
  name: string;
  ownerUserId: string;
  members: TeamMember[];
  createdAt: string;
}

export function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { apiFetch } = useApi();
  const { addToast } = useToast();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add member state
  const [addEmail, setAddEmail] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // Remove member confirmation
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Delete team confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTeam = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Team>(`/teams/${id}`);
      setTeam(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load team');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [id, apiFetch]);

  // Owner controls are rendered for all users; the backend enforces ownership.
  // Non-owners who attempt add/remove/delete receive a 403 shown as an error toast.
  const showOwnerControls = true;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) return;
    setIsAdding(true);
    try {
      await apiFetch(`/teams/${id}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: addEmail.trim() }),
      });
      addToast('Member added', 'success');
      setAddEmail('');
      await fetchTeam();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to add member', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!removingUserId) return;
    setIsRemoving(true);
    try {
      await apiFetch(`/teams/${id}/members/${removingUserId}`, { method: 'DELETE' });
      addToast('Member removed', 'success');
      setRemovingUserId(null);
      await fetchTeam();
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to remove member', 'error');
    } finally {
      setIsRemoving(false);
    }
  };

  const handleDeleteTeam = async () => {
    setIsDeleting(true);
    try {
      await apiFetch(`/teams/${id}`, { method: 'DELETE' });
      addToast('Team deleted', 'success');
      navigate('/teams');
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to delete team', 'error');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;
  if (error) return <ErrorState error={error} onRetry={fetchTeam} />;
  if (!team) return <ErrorState error="Team not found" />;

  return (
    <div>
      {/* Breadcrumb */}
      <Link to="/teams" className="text-sm text-gray-500 hover:text-gray-700 inline-block mb-4">
        ← Teams
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
            </p>
          </div>
          {showOwnerControls && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 size={14} />
              Delete Team
            </Button>
          )}
        </div>
      </div>

      {/* Members */}
      <div className="bg-white rounded-xl border border-gray-200 mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Members</h2>
        </div>

        {team.members.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">
            No members yet. Add members below.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {team.members.map((member) => (
              <div key={member.userId} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-gray-800">{member.email}</span>
                {showOwnerControls && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemovingUserId(member.userId)}
                  >
                    <UserMinus size={14} />
                    Remove
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Add member form */}
        {showOwnerControls && (
          <div className="px-5 py-4 border-t border-gray-100">
            <form onSubmit={handleAddMember} className="flex gap-3">
              <input
                type="email"
                placeholder="member@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <Button type="submit" size="sm" loading={isAdding}>
                <UserPlus size={14} />
                Add Member
              </Button>
            </form>
          </div>
        )}
      </div>

      {/* Confirm remove member */}
      <ConfirmDialog
        open={removingUserId !== null}
        title="Remove Member"
        message="Remove this member from the team? They will lose access to all team-owned pipelines."
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
        onCancel={() => setRemovingUserId(null)}
        loading={isRemoving}
      />

      {/* Confirm delete team */}
      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Team"
        message="This will delete the team. Team pipelines will be transferred to your personal workspace. This cannot be undone."
        confirmLabel="Delete Team"
        onConfirm={handleDeleteTeam}
        onCancel={() => setShowDeleteConfirm(false)}
        loading={isDeleting}
      />
    </div>
  );
}
