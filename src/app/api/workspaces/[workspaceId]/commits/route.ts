import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, projects, workspaceMembers, workspaces } from "@/db/schema";
import { getAuthenticatedUser, jsonUnauthorized, jsonError } from "@/lib/api-session";
import { GithubIntegrationService } from "@/modules/github/github-integration.service";
import { listRepositoryCommits } from "@/integration/github/github-app";

interface RouteContext { params: Promise<{ workspaceId: string }> }

export async function GET(_request: NextRequest, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return jsonUnauthorized();
  const { workspaceId } = await context.params;
  try {
    const [workspace] = await db.select({ id: workspaces.id, ownerId: workspaces.ownerId })
      .from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1);
    if (!workspace) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    const [member] = await db.select({ id: workspaceMembers.id })
      .from(workspaceMembers).where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, user.id))).limit(1);
    if (workspace.ownerId !== user.id && !member) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const installations = await db.select().from(githubInstallations)
      .where(and(eq(githubInstallations.workspaceId, workspaceId), eq(githubInstallations.status, "active")));
    if (!installations.length) {
      const commits = await GithubIntegrationService.getWorkspaceCommits(user.id, workspaceId);
      return NextResponse.json({ commits });
    }

    const linkedProjects = await db.select({
      id: projects.id, repoOwner: projects.repoOwner, repoName: projects.repoName,
      githubInstallationId: projects.githubInstallationId,
    }).from(projects).where(eq(projects.workspaceId, workspaceId));
    const installationByLocalId = new Map(installations.map((item) => [item.id, item]));
    const commitsByRepo = await Promise.all(linkedProjects.filter((project) => project.githubInstallationId && installationByLocalId.has(project.githubInstallationId)).map(async (project) => {
      const installation = installationByLocalId.get(project.githubInstallationId!);
      if (!installation) return [];
      const commits = await listRepositoryCommits(installation.installationId, project.repoOwner, project.repoName, 10);
      return commits.map((commit) => ({
        id: commit.sha, sha: commit.sha, shortSha: commit.sha.slice(0, 7),
        message: commit.commit.message.split("\n")[0],
        author: commit.author?.login ?? commit.commit.author?.name ?? commit.commit.committer?.name ?? "Unknown",
        authorAvatar: commit.author?.avatar_url ?? undefined,
        date: commit.commit.author?.date ?? commit.commit.committer?.date ?? new Date(0).toISOString(),
        repoName: project.repoName, repoOwner: project.repoOwner, url: commit.html_url,
      }));
    }));
    const commits = commitsByRepo.flat().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 100);
    return NextResponse.json({ commits });
  } catch (error) {
    return jsonError(error);
  }
}
