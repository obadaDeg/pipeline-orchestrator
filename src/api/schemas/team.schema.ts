import { z } from 'zod';

export const CreateTeamBodySchema = z.object({
  name: z.string().min(1),
});

export const AddMemberBodySchema = z.object({
  email: z.string().email(),
});

export type CreateTeamBody = z.infer<typeof CreateTeamBodySchema>;
export type AddMemberBody = z.infer<typeof AddMemberBodySchema>;
