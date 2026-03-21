import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pipelines, teamMemberships, teams, users } from '../db/schema.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { emitAuditEvent } from './auth.service.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TeamMember {
  userId: string;
  email: string;
  joinedAt: Date;
}

export interface TeamResult {
  id: string;
  name: string;
  ownerUserId: string;
  members: TeamMember[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireTeamOwner(teamId: string, requestingUserId: string) {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) throw new NotFoundError('TEAM_NOT_FOUND', 'Team not found');
  if (team.ownerUserId !== requestingUserId) {
    throw new NotFoundError('TEAM_NOT_FOUND', 'Team not found'); // 404 to prevent enumeration
  }
  return team;
}

// ─── Service Functions ────────────────────────────────────────────────────────

/**
 * Returns all team IDs the user owns or is a member of.
 * Used by pipeline service to scope visibility.
 */
export async function getUserTeamIds(userId: string): Promise<string[]> {
  const [ownedRows, memberRows] = await Promise.all([
    db.select({ id: teams.id }).from(teams).where(eq(teams.ownerUserId, userId)),
    db.select({ id: teamMemberships.teamId }).from(teamMemberships).where(eq(teamMemberships.userId, userId)),
  ]);
  return [...new Set([...ownedRows.map((r) => r.id), ...memberRows.map((r) => r.id)])];
}

export async function createTeam(ownerUserId: string, name: string): Promise<TeamResult> {
  const [team] = await db.insert(teams).values({ ownerUserId, name }).returning();
  await emitAuditEvent(ownerUserId, 'TEAM_CREATED', { teamId: team.id, name });
  return { id: team.id, name: team.name, ownerUserId: team.ownerUserId, members: [], createdAt: team.createdAt, updatedAt: team.updatedAt };
}

export async function getTeam(teamId: string, requestingUserId: string): Promise<TeamResult> {
  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) throw new NotFoundError('TEAM_NOT_FOUND', 'Team not found');

  // Must be owner or member — use 404 to prevent enumeration
  const teamIds = await getUserTeamIds(requestingUserId);
  if (!teamIds.includes(teamId)) {
    throw new NotFoundError('TEAM_NOT_FOUND', 'Team not found');
  }

  const members = await db
    .select({ userId: users.id, email: users.email, joinedAt: teamMemberships.createdAt })
    .from(teamMemberships)
    .innerJoin(users, eq(teamMemberships.userId, users.id))
    .where(eq(teamMemberships.teamId, teamId));

  return {
    id: team.id,
    name: team.name,
    ownerUserId: team.ownerUserId,
    members: members.map((m) => ({ userId: m.userId, email: m.email, joinedAt: m.joinedAt })),
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  };
}

export async function deleteTeam(teamId: string, requestingUserId: string): Promise<void> {
  const team = await requireTeamOwner(teamId, requestingUserId);

  await db.transaction(async (tx) => {
    // Transfer all team pipelines to the owner's personal workspace
    await tx
      .update(pipelines)
      .set({ ownerUserId: team.ownerUserId, ownerTeamId: null })
      .where(eq(pipelines.ownerTeamId, teamId));

    // Delete the team (cascades memberships)
    await tx.delete(teams).where(eq(teams.id, teamId));
  });

  await emitAuditEvent(requestingUserId, 'TEAM_DELETED', { teamId, name: team.name });
}

export async function addMember(teamId: string, ownerUserId: string, targetEmail: string): Promise<TeamMember> {
  const team = await requireTeamOwner(teamId, ownerUserId);

  const [targetUser] = await db.select().from(users).where(eq(users.email, targetEmail.toLowerCase()));
  if (!targetUser) {
    throw new NotFoundError('USER_NOT_FOUND', 'No user with that email address');
  }

  // Owner is implicitly a member — block adding them explicitly
  if (team.ownerUserId === targetUser.id) {
    throw new AppError(422, 'ALREADY_A_MEMBER', 'User is the team owner and is already a member');
  }

  const memberships = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.teamId, teamId));

  if (memberships.some((m) => m.userId === targetUser.id)) {
    throw new AppError(422, 'ALREADY_A_MEMBER', 'User is already a member of this team');
  }

  const [membership] = await db
    .insert(teamMemberships)
    .values({ teamId, userId: targetUser.id })
    .returning();

  await emitAuditEvent(ownerUserId, 'TEAM_MEMBER_ADDED', { teamId, addedUserId: targetUser.id, email: targetUser.email });

  return { userId: targetUser.id, email: targetUser.email, joinedAt: membership.createdAt };
}

export async function removeMember(teamId: string, ownerUserId: string, targetUserId: string): Promise<void> {
  const team = await requireTeamOwner(teamId, ownerUserId);

  // Block removing the owner from their own team
  if (team.ownerUserId === targetUserId) {
    throw new AppError(422, 'CANNOT_REMOVE_OWNER', 'The team owner cannot be removed from the team');
  }

  const memberships = await db
    .select()
    .from(teamMemberships)
    .where(eq(teamMemberships.teamId, teamId));

  const found = memberships.find((m) => m.userId === targetUserId);
  if (!found) {
    throw new NotFoundError('MEMBER_NOT_FOUND', 'User is not a member of this team');
  }

  await db.delete(teamMemberships).where(eq(teamMemberships.id, found.id));
  await emitAuditEvent(ownerUserId, 'TEAM_MEMBER_REMOVED', { teamId, removedUserId: targetUserId });
}
