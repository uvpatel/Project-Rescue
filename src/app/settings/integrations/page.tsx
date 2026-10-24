"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { GitBranch, Webhook, CheckCircle2, ExternalLink, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { GitHubAppConnect } from "@/components/github/GitHubAppConnect";

interface GithubStatus {
  connected: boolean;
  login?: string;
  name?: string | null;
  avatarUrl?: string;
  scope?: string | null;
  connectedProjectsCount: number;
}

export default function IntegrationsPage() {
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const [githubStatus, setGithubStatus] = React.useState<GithubStatus | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!workspaceId) return;
    let isSubscribed = true;
    fetch(`/api/workspaces/${workspaceId}/integrations/github`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (isSubscribed && data) {
          setGithubStatus(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch github status:", err);
        if (isSubscribed) setLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [workspaceId]);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/80 pb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="size-4 text-foreground" />
              <h1 className="text-2xl sm:text-3xl font-normal tracking-tight text-foreground">
                Integrations &amp; Connectors
              </h1>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm font-sans">
              Manage GitHub credentials and secure webhook endpoints for workspace{" "}
              <span className="font-mono text-foreground">{currentWorkspace?.name || "..."}</span>.
            </p>
          </div>
        </div>

        <GitHubAppConnect />

        <div className="grid gap-6 md:grid-cols-2">
          {/* GitHub Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between mb-2">
                {loading ? (
                  <Badge variant="outline" className="gap-1 text-[10px] font-mono">
                    <RefreshCw className="size-3 animate-spin" /> Checking
                  </Badge>
                ) : githubStatus?.connected ? (
                  <Badge variant="outline" className="text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1 text-[10px] font-mono">
                    <CheckCircle2 className="size-3" /> Connected
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1 text-[10px] font-mono">
                    <AlertCircle className="size-3" /> Not Connected
                  </Badge>
                )}
                <span className="text-[11px] font-mono text-muted-foreground">OAuth 2.0</span>
              </div>
              <CardTitle className="text-base font-medium font-sans flex items-center gap-2">
                <GitBranch className="size-4 text-foreground" /> GitHub Integration
              </CardTitle>
              <CardDescription className="text-xs font-sans text-muted-foreground">
                Authorizes ProjectRescue to index repository metadata, read CI status, and draft pull requests.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 font-mono text-xs">
              {githubStatus?.connected ? (
                <>
                  <div className="flex items-center gap-3 p-3 rounded-md border border-border/80 bg-muted/30">
                    <Avatar className="size-9 rounded-md border border-border">
                      <AvatarImage src={githubStatus.avatarUrl} alt={githubStatus.login} />
                      <AvatarFallback className="rounded-md text-xs">{githubStatus.login?.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-xs truncate text-foreground font-sans">
                        {githubStatus.name || githubStatus.login}
                      </div>
                      <div className="text-[11px] text-muted-foreground font-mono">@{githubStatus.login}</div>
                    </div>
                  </div>

                  <div className="space-y-2 bg-muted/20 p-3 rounded-md border border-border/70 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">Connected Projects:</span>
                      <span className="font-semibold text-foreground">{githubStatus.connectedProjectsCount}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">Access Scope:</span>
                      <span className="text-foreground">{githubStatus.scope || "repo, read:user"}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground font-sans">PR Authorization:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">Explicit Approval Gated</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1">
                    <a href={`https://github.com/${githubStatus.login}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="outline" className="gap-1 text-xs font-mono h-7 shadow-none">
                        <span>View Profile on GitHub</span>
                        <ExternalLink className="size-3" />
                      </Button>
                    </a>
                  </div>
                </>
              ) : (
                <div className="space-y-3 font-sans">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Link your GitHub account to import repositories and monitor dependency blockers.
                  </p>
                  <Link href="/sign-in">
                    <Button size="sm" className="gap-1.5 font-mono text-xs h-8 shadow-none">
                      <GitBranch className="size-3.5" />
                      <span>Connect GitHub Account</span>
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Webhook Delivery Card */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3 border-b border-border/70">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-foreground border-border gap-1 text-[10px] font-mono">
                  Active
                </Badge>
                <span className="text-[11px] font-mono text-muted-foreground">HMAC-SHA256</span>
              </div>
              <CardTitle className="text-base font-medium font-sans flex items-center gap-2">
                <Webhook className="size-4 text-foreground" /> Webhook Listener
              </CardTitle>
              <CardDescription className="text-xs font-sans text-muted-foreground">
                Processes GitHub push, check_suite, and issue events in real time with cryptographic signature verification.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4 font-mono text-xs">
              <div className="space-y-2.5 bg-muted/20 p-3.5 rounded-md border border-border/70 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">Endpoint:</span>
                  <span className="text-foreground">/api/webhooks/github</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">Deduplication:</span>
                  <span className="text-emerald-600 dark:text-emerald-400">github_delivery_events</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground font-sans">Signature Guard:</span>
                  <span className="text-foreground">X-Hub-Signature-256</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
