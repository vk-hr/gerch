function httpUrl(raw: string | undefined): string | null {
  if (raw === undefined || !URL.canParse(raw)) {
    return null
  }
  const url = new URL(raw)
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return null
  }
  return raw
}

// Turns the repository strings registries publish (git remotes, ssh, https)
// into a browsable https URL, or null.
function repositoryUrl(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null
  }
  const https = raw
    .replace(/^git\+/u, "")
    .replace(/^git:\/\//u, "https://")
    .replace(/^ssh:\/\/git@/u, "https://")
    .replace(/^git@(?<host>[^:]+):/u, "https://$<host>/")
    .replace(/\.git$/u, "")
  return httpUrl(https)?.replace(/\/$/u, "") ?? null
}

export { httpUrl, repositoryUrl }
