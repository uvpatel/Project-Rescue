import { createHash, randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallStates, workspaceMembers, workspaces } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/api-session";
import { workspaceIdSchema } from "@/schemas/github-install.schema";
export const runtime = "nodejs";
export async function GET(request: NextRequest, context: { params: Promise<{ workspaceId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!workspaceIdSchema.safeParse(workspaceId).success) return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  const [workspace] = await db.select({ id: workspaces.id, ownerId: workspaces.ownerId }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id))).limit(1);
  if (workspace.ownerId !== user.id && !membership) return NextResponse.json({ error: "You do not have access to this workspace" }, { status: 403 });
  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return NextResponse.json({ error: "GitHub App is not configured on the server" }, { status: 503 });
  const rawState = randomBytes(32).toString("base64url");
  await db.insert(githubInstallStates).values({ stateHash: createHash("sha256").update(rawState).digest("hex"), userId: user.id, workspaceId, expiresAt: new Date(Date.now() + 10 * 60 * 1000) });
  const installUrl = new URL(`https://github.com/apps/${encodeURIComponent(slug)}/installations/new`);
  installUrl.searchParams.set("state", rawState);
  installUrl.searchParams.set("redirect_url", `${process.env.APP_URL || process.env.BETTER_AUTH_URL || request.nextUrl.origin}/api/github/callback`);
  return NextResponse.redirect(installUrl);
}
