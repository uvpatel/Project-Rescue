import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallations, projects, workspaceMembers, workspaces } from "@/db/schema";
import { getAuthenticatedUser, jsonUnauthorized, jsonError } from "@/lib/api-session";
import { GithubIntegrationService } from "@/modules/github/github-integration.service";
import { listInstallationRepositories } from "@/integration/github/github-app";

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
    if (installations.length) {
      const repositories = [];
      for (const installation of installations) {
        const repos = await listInstallationRepositories(installation.installationId);
        for (const repo of repos) {
          const [project] = await db.select({ id: projects.id }).from(projects).where(and(
            eq(projects.workspaceId, workspaceId), eq(projects.githubRepoId, repo.id),
          )).limit(1);
          repositories.push({
            id: repo.id, name: repo.name, fullName: repo.full_name, owner: repo.owner.login,
            defaultBranch: repo.default_branch || "main", isPrivate: repo.private,
            description: repo.description, htmlUrl: repo.html_url, isConnected: Boolean(project),
            projectId: project?.id,
          });
        }
      }
      return NextResponse.json({ repositories });
    }

    // Preserve the existing OAuth integration for workspaces that have not installed the GitHub App.
    const repos = await GithubIntegrationService.listAvailableRepositories(user.id, workspaceId);
    return NextResponse.json({ repositories: repos });
  } catch (error) {
    return jsonError(error);
  }
}
