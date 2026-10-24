import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, projects, workspaceMembers, workspaces } from "@/db/schema";
import { getAuthenticatedUser } from "@/lib/api-session";
import { listRepositoryCommits } from "@/integration/github/github-app";
import { commitQuerySchema, repositoryIdSchema, workspaceIdSchema } from "@/schemas/github-install.schema";
export const runtime = "nodejs";
export async function GET(request: Request, context: { params: Promise<{ workspaceId: string }> }) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  const { workspaceId } = await context.params;
  const query = new URL(request.url).searchParams;
  const projectId = query.get("projectId");
  const parsedQuery = commitQuerySchema.safeParse({ limit: query.get("limit") ?? 20 });
  if (!workspaceIdSchema.safeParse(workspaceId).success || !projectId || !repositoryIdSchema.safeParse(projectId).success || !parsedQuery.success) return NextResponse.json({ error: "Invalid workspace, project, or limit" }, { status: 400 });
  const [workspace] = await db.select({ id: workspaces.id, ownerId: workspaces.ownerId }).from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
  const [membership] = await db.select({ id: workspaceMembers.id }).from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id))).limit(1);
  if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  if (workspace.ownerId !== user.id && !membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const [project] = await db.select({ id: projects.id, repoOwner: projects.repoOwner, repoName: projects.repoName, githubInstallationId: projects.githubInstallationId }).from(projects).where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId))).limit(1);
  if (!project || !project.githubInstallationId) return NextResponse.json({ error: "Connected repository not found" }, { status: 404 });
  const [installation] = await db.select({ installationId: githubInstallations.installationId, status: githubInstallations.status }).from(githubInstallations).where(and(eq(githubInstallations.id, project.githubInstallationId), eq(githubInstallations.workspaceId, workspaceId))).limit(1);
  if (!installation || installation.status !== "active") return NextResponse.json({ error: "GitHub installation is not active" }, { status: 409 });
  try {
    const commits = await listRepositoryCommits(installation.installationId, project.repoOwner, project.repoName, parsedQuery.data.limit);
    return NextResponse.json({ commits: commits.map((commit) => ({ sha: commit.sha, shortSha: commit.sha.slice(0, 7), message: commit.commit.message.split("\n")[0], author: commit.author?.login ?? commit.commit.author?.name ?? commit.commit.committer?.name ?? "Unknown", authorAvatar: commit.author?.avatar_url ?? null, date: commit.commit.author?.date ?? commit.commit.committer?.date ?? null, url: commit.html_url, repoOwner: project.repoOwner, repoName: project.repoName })) });
  } catch (error) {
    console.error("GitHub commit listing failed", { projectId, message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.json({ error: "Could not fetch commits. The app may need Contents: read permission." }, { status: 502 });
  }
}
