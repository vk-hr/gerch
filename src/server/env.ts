// The only place server code reads environment variables.

const SHORT_SHA = 7
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  return url === undefined || url === "" ? undefined : url
}

// Set only by the end-to-end server: serve recorded fixtures, no network.
function replayDir(): string | undefined {
  const dir = process.env.GERCH_REPLAY_DIR
  return dir === undefined || dir === "" ? undefined : dir
}

// The deployed commit, which Vercel sets; "local" elsewhere.
function release(): string {
  const sha = process.env.VERCEL_GIT_COMMIT_SHA
  return sha === undefined || sha === "" ? "local" : sha.slice(0, SHORT_SHA)
}

export { databaseUrl, release, replayDir }
