// The only place server code reads environment variables.
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  return url === undefined || url === "" ? undefined : url
}

// Set only by the end-to-end server: serve recorded fixtures, no network.
function replayDir(): string | undefined {
  const dir = process.env.GERCH_REPLAY_DIR
  return dir === undefined || dir === "" ? undefined : dir
}

export { databaseUrl, replayDir }
