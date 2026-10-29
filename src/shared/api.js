const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const isLocalApiUrl = configuredApiUrl?.startsWith('http://localhost:')

export const apiUrl = configuredApiUrl && !(import.meta.env.PROD && isLocalApiUrl)
  ? configuredApiUrl
  : import.meta.env.PROD
    ? '/api'
    : 'http://localhost:4000/api'