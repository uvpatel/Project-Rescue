import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, projects, workspaceMembers, workspaces } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/api-session";
import { listInstallationRepositories } from "@/integration/github/github-app";
import { workspaceIdSchema } from "@/schemas/github-install.schema";
export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { workspaceId } = await context.params;
  if (!workspaceIdSchema.safeParse(workspaceId).success) return NextResponse.json({ error: "Invalid workspace ID" }, { status: 400 });
  const [workspace] = await db.select({ id: workspaces.id, ownerId: workspaces.ownerId }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id))).limit(1);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (workspace.ownerId !== user.id && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const installations = await db.select().from(githubInstallations).where(and(eq(githubInstallations.workspaceId, workspaceId), eq(githubInstallations.status, "active")));
  const repositories = [];
  try {
    for (const installation of installations) {
      const repos = await listInstallationRepositories(installation.installationId);
      for (const repo of repos) {
        const [project] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.workspaceId, workspaceId), eq(projects.githubRepoId, repo.id))).limit(1);
        repositories.push({ id: repo.id, name: repo.name, fullName: repo.full_name, owner: repo.owner.login, defaultBranch: repo.default_branch, isPrivate: repo.private, description: repo.description, htmlUrl: repo.html_url, updatedAt: repo.updated_at, isConnected: Boolean(project), projectId: project?.id });
      }
    }
    return NextResponse.json({ repositories });
  } catch (error) {
    console.error("GitHub App repository fetch failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "GitHub repositories could not be fetched. Verify app permissions and retry." }, { status: 502 });
  }
}
