import 'express';

/**
 * Authenticated user attached to the request by the authenticate middleware.
 */
export interface AuthUser {
  id: string;
  email: string;
}

declare module 'express' {
  interface Request {
    user?: AuthUser;
  }
}
