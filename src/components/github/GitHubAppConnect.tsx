"use client";
import { useState } from "react";
import { useWorkspace } from "@/providers/WorkspaceProvider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Github, ExternalLink, ShieldCheck } from "lucide-react";
export function GitHubAppConnect() {
  const { currentWorkspace } = useWorkspace();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function connect() {
    if (!currentWorkspace?.id) { setError("Choose a workspace before connecting GitHub."); return; }
    setConnecting(true); setError(null);
    try {
      window.location.assign(`/api/workspaces/${currentWorkspace.id}/github/install`);
    } catch {
      setConnecting(false); setError("Could not start GitHub App installation.");
    }
  }
  return <Card>
    <CardHeader>
      <div className="flex items-center gap-2">
        <Github className="size-5" />
        <CardTitle>GitHub App</CardTitle>
      </div>
      <CardDescription>Connect repositories with installation-scoped, short-lived tokens. ProjectRescue never asks for a personal access token.</CardDescription>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><span>Choose only the repositories you want ProjectRescue to access on GitHub’s installation screen.</span></div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button onClick={connect} disabled={connecting || !currentWorkspace?.id} className="gap-2">
        <Github className="size-4" />{connecting ? "Redirecting…" : "Connect GitHub repositories"}<ExternalLink className="size-3.5" />
      </Button>
    </CardContent>
  </Card>;
}
