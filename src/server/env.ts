// The only place server code reads environment variables.
function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL
  return url === undefined || url === "" ? undefined : url
}

export { databaseUrl }
