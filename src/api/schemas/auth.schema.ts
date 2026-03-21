import { z } from 'zod';

export const RegisterBodySchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const LoginBodySchema = z.object({
  email: z.string().email('Must be a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const CreateApiKeyBodySchema = z.object({
  name: z.string().min(1, 'Key name is required'),
});

export type RegisterBody = z.infer<typeof RegisterBodySchema>;
export type LoginBody = z.infer<typeof LoginBodySchema>;
export type CreateApiKeyBody = z.infer<typeof CreateApiKeyBodySchema>;
