import { createHash } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { githubInstallStates, githubInstallations, projects } from "@/db/schema";
import { auth } from "@/lib/auth";
import { getInstallation, listInstallationRepositories } from "@/integration/github/github-app";
import { installationIdSchema } from "@/schemas/github-install.schema";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.redirect(new URL("/sign-in?error=github_auth_required", request.url));
  const state = request.nextUrl.searchParams.get("state");
  const parsedInstallationId = installationIdSchema.safeParse(request.nextUrl.searchParams.get("installation_id"));
  const setupAction = request.nextUrl.searchParams.get("setup_action");
  if (!state || !parsedInstallationId.success || (setupAction !== "install" && setupAction !== "update")) return NextResponse.redirect(new URL("/repositories?github_error=invalid_callback", request.url));
  const stateHash = createHash("sha256").update(state).digest("hex");
  const [installState] = await db.select().from(githubInstallStates).where(and(eq(githubInstallStates.stateHash, stateHash), eq(githubInstallStates.userId, session.user.id), isNull(githubInstallStates.consumedAt), gt(githubInstallStates.expiresAt, new Date()))).limit(1);
  if (!installState) return NextResponse.redirect(new URL("/repositories?github_error=invalid_state", request.url));
  const [consumedState] = await db.update(githubInstallStates).set({ consumedAt: new Date() }).where(and(eq(githubInstallStates.id, installState.id), isNull(githubInstallStates.consumedAt), gt(githubInstallStates.expiresAt, new Date()))).returning({ id: githubInstallStates.id });
  if (!consumedState) return NextResponse.redirect(new URL("/repositories?github_error=invalid_state", request.url));
  try {
    const installationId = parsedInstallationId.data;
    const installation = await getInstallation(installationId);
    if (installation.id !== installationId || !installation.account || installation.suspended_at) return NextResponse.redirect(new URL("/repositories?github_error=installation_unavailable", request.url));
    const [existing] = await db.select({ id: githubInstallations.id, workspaceId: githubInstallations.workspaceId }).from(githubInstallations).where(eq(githubInstallations.installationId, installationId)).limit(1);
    let localInstallationId: string;
    if (existing) {
      if (existing.workspaceId !== installState.workspaceId) return NextResponse.redirect(new URL("/repositories?github_error=installation_already_linked", request.url));
      localInstallationId = existing.id;
      await db.update(githubInstallations).set({ accountLogin: installation.account.login, accountType: installation.account.type, repositorySelection: installation.repository_selection, permissions: installation.permissions, installedByUserId: session.user.id, status: "active", updatedAt: new Date() }).where(eq(githubInstallations.id, localInstallationId));
    } else {
      const [created] = await db.insert(githubInstallations).values({ workspaceId: installState.workspaceId, installationId, accountLogin: installation.account.login, accountType: installation.account.type, repositorySelection: installation.repository_selection, permissions: installation.permissions, installedByUserId: session.user.id, status: "active" }).returning({ id: githubInstallations.id });
      if (!created) throw new Error("Could not save GitHub installation");
      localInstallationId = created.id;
    }
    const repos = await listInstallationRepositories(installationId);
    for (const repo of repos) {
      const [existingProject] = await db.select({ id: projects.id }).from(projects).where(and(eq(projects.workspaceId, installState.workspaceId), eq(projects.githubRepoId, repo.id))).limit(1);
      const values = { workspaceId: installState.workspaceId, githubInstallationId: localInstallationId, name: repo.name, repoOwner: repo.owner.login, repoName: repo.name, githubRepoId: repo.id, defaultBranch: repo.default_branch || "main", status: "active", lastSyncedAt: new Date() };
      if (existingProject) await db.update(projects).set(values).where(eq(projects.id, existingProject.id));
      else await db.insert(projects).values(values);
    }
    return NextResponse.redirect(new URL("/repositories?github_connected=1", request.url));
  } catch (error) {
    console.error("GitHub installation callback failed", { message: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.redirect(new URL("/repositories?github_error=connection_failed", request.url));
  }
}
