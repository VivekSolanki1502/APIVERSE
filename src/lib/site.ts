/**
 * Site-level configuration. The repository URL is only shown when it is actually configured,
 * so the app never links to a placeholder.
 */
function cleanRepoUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return null;
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export const REPO_URL: string | null = cleanRepoUrl(import.meta.env.VITE_REPO_URL);

/** Pre-filled "outdated information" issue link, or null when no repository is configured. */
export function reportIssueUrl(apiId: string, apiName: string, repo: string | null = REPO_URL): string | null {
  if (!repo) return null;
  const title = encodeURIComponent(`Outdated info: ${apiName}`);
  const body = encodeURIComponent(`API id: ${apiId}\n\nWhat is outdated or wrong?\n\nOfficial source URL showing the correct information:\n`);
  return `${repo}/issues/new?labels=data-correction&title=${title}&body=${body}`;
}

export { cleanRepoUrl };
