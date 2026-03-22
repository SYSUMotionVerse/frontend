export function buildMiniProgramQueryString(
  query: Record<string, string | number | boolean | undefined>
) {
  return Object.entries(query)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}
