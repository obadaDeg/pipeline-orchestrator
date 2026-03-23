import { Plus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { useApi } from '../hooks/useApi';
import { useToast } from '../hooks/useToast';

interface Team {
  id: string;
  name: string;
  ownerUserId: string;
  memberCount: number;
  isOwner: boolean;
  createdAt: string;
}

interface CreateTeamResponse {
  id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
}

export function TeamsPage() {
  const { apiFetch } = useApi();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const fetchTeams = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<{ items: Team[] }>('/teams');
      setTeams(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [apiFetch]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    setIsCreating(true);
    try {
      const team = await apiFetch<CreateTeamResponse>('/teams', {
        method: 'POST',
        body: JSON.stringify({ name: newTeamName.trim() }),
      });
      addToast('Team created', 'success');
      navigate(`/teams/${team.id}`);
    } catch (err: unknown) {
      addToast(err instanceof Error ? err.message : 'Failed to create team', 'error');
      setIsCreating(false);
    }
  };

  if (loading) return <div className="animate-pulse h-40 bg-gray-100 rounded-xl" />;
  if (error) return <ErrorState error={error} onRetry={fetchTeams} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New Team
        </Button>
      </div>

      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex gap-3"
        >
          <input
            autoFocus
            type="text"
            placeholder="Team name"
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <Button type="submit" loading={isCreating}>
            Create
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => { setShowCreate(false); setNewTeamName(''); }}
          >
            Cancel
          </Button>
        </form>
      )}

      {teams.length === 0 ? (
        <EmptyState
          icon={Users}
          heading="No teams yet"
          body="Create a team to share pipelines with other users."
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {teams.map((team) => (
            <div key={team.id} className="flex items-center justify-between px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{team.name}</span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      team.isOwner
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {team.isOwner ? 'Owner' : 'Member'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                </p>
              </div>
              <Link
                to={`/teams/${team.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
              >
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
