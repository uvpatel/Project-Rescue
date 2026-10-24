import { z } from "zod";
export const workspaceIdSchema = z.string().uuid();
export const installationIdSchema = z.coerce.number().int().positive().safe();
export const repositoryIdSchema = z.string().uuid();
export const commitQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });
