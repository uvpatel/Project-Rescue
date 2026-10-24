import "server-only";
import { createPrivateKey, createSign } from "node:crypto";
const API_BASE = "https://api.github.com";
function base64Url(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}
async function createAppJwt(): Promise<string> {
  const appId = requiredEnv("GITHUB_APP_ID");
  const pem = requiredEnv("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64Url(JSON.stringify({ iat: now - 60, exp: now + 8 * 60, iss: appId }))}`;
  // Node's key parser supports GitHub's downloaded RSA PRIVATE KEY (PKCS#1)
  // and PRIVATE KEY (PKCS#8) PEM formats.
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(createPrivateKey(pem)).toString("base64url");
  return `${unsigned}.${signature}`;
}
async function githubRequest<T>(path: string, token: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "ProjectRescue", ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    const requestId = response.headers.get("x-github-request-id");
    if ([401, 403, 404].includes(response.status)) throw new GitHubApiError("GitHub denied this request. Check the app installation and permissions.", response.status, requestId);
    if ([429, 502, 503].includes(response.status)) throw new GitHubApiError("GitHub is temporarily rate-limiting or unavailable. Please retry shortly.", response.status, requestId);
    throw new GitHubApiError("GitHub API request failed.", response.status, requestId);
  }
  return response.json() as Promise<T>;
}
export class GitHubApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly requestId: string | null = null) { super(message); this.name = "GitHubApiError"; }
}
export interface GitHubInstallationInfo {
  id: number; account: { login: string; type: string } | null; repository_selection: "all" | "selected";
  permissions: Record<string, string>; suspended_at: string | null;
}
export interface GitHubRepository {
  id: number; name: string; full_name: string; owner: { login: string }; private: boolean;
  description: string | null; html_url: string; default_branch: string; updated_at: string;
}
export interface GitHubCommit {
  sha: string; html_url: string; commit: { message: string; author: { name: string; date: string } | null; committer: { name: string; date: string } | null };
  author: { login: string; avatar_url: string; html_url: string } | null;
}
export async function getInstallation(installationId: number): Promise<GitHubInstallationInfo> {
  return githubRequest<GitHubInstallationInfo>(`/app/installations/${installationId}`, await createAppJwt());
}
export async function createInstallationToken(installationId: number): Promise<string> {
  const result = await githubRequest<{ token: string }>(`/app/installations/${installationId}/access_tokens`, await createAppJwt(), { method: "POST", body: JSON.stringify({}) });
  return result.token;
}
export async function listInstallationRepositories(installationId: number): Promise<GitHubRepository[]> {
  const token = await createInstallationToken(installationId);
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 10; page++) {
    const result = await githubRequest<{ repositories: GitHubRepository[]; total_count: number }>(`/installation/repositories?per_page=100&page=${page}`, token);
    repositories.push(...result.repositories);
    if (repositories.length >= result.total_count || result.repositories.length < 100) break;
  }
  return repositories;
}
export async function listRepositoryCommits(installationId: number, owner: string, repo: string, perPage = 20): Promise<GitHubCommit[]> {
  const token = await createInstallationToken(installationId);
  return githubRequest<GitHubCommit[]>(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/commits?per_page=${perPage}`, token);
}
