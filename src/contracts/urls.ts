/** Resolve an application path without discarding the gateway's routing query. */
export function routedUrl(base: string, relative: string) {
  const source = new URL(base);
  if (!source.pathname.endsWith("/")) source.pathname += "/";
  const result = new URL(relative.replace(/^\//, ""), source);
  for (const [key, value] of source.searchParams) {
    if (!result.searchParams.has(key)) result.searchParams.append(key, value);
  }
  return result;
}
