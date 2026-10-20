export const builtInFigures = ['triangle', 'circle', 'rectangle']

export const isHttpImageUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}

export const isValidFigure = (value) => value === ''
  || builtInFigures.includes(value)
  || isHttpImageUrl(value)
