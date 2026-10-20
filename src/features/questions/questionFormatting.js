export const builtInFigures = ['triangle', 'circle', 'rectangle']
export const isMathExpression = (value) => /[\^_=+*/√]|[a-zA-Z]\d/.test(value)
export const equationMarker = '[[সূত্র]]'
export const mathTokenPattern = /(\[\[সূত্র\]\]|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\(?:frac|dfrac|tfrac|binom)\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\}(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?|\\sqrt\s*(?:\[[^\]\n]*\]\s*)?\{(?:[^{}\n]|\{[^{}\n]*\})*\}|\\(?:sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|theta|alpha|beta|gamma|delta|pi|omega)\b(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?)/g
export const promptText = (value = '') => value.split(equationMarker).join('').replace(/\s+/g, ' ').trim()
export const bengaliNumber = (value) => Number(value).toLocaleString('bn-BD')

export const isHttpImageUrl = (value) => {
  try {
    const url = new URL(value)
    return value.length <= 2048 && ['http:', 'https:'].includes(url.protocol)
  } catch {
    return false
  }
}
