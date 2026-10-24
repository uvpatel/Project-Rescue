import { AppShell } from "@/components/layout/AppShell";
import { GitHubAppConnect } from "@/components/github/GitHubAppConnect";
export default function GitHubAppSettingsPage() {
  return <AppShell><main className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
    <div className="space-y-1"><h1 className="text-2xl font-semibold tracking-tight">GitHub App connection</h1><p className="text-sm text-muted-foreground">Connect only the repositories you want ProjectRescue to inspect.</p></div>
    <GitHubAppConnect />
  </main></AppShell>;
}
