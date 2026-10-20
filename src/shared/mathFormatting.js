export const equationMarker = '[[সূত্র]]'

export const questionMathTokenPattern = /(\[\[সূত্র\]\]|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\)|\\(?:frac|dfrac|tfrac|binom)\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\}(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?|\\sqrt\s*(?:\[[^\]\n]*\]\s*)?\{(?:[^{}\n]|\{[^{}\n]*\})*\}|\\(?:sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|theta|alpha|beta|gamma|delta|pi|omega)\b(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?)/g

export const examMathTokenPattern = /(\[\[সূত্র\]\]|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\$[^$\n]+\$|\\\([\s\S]+?\\\)|(?:[A-Za-z0-9]+(?:\^\{[^{}\n]+\}|_\{[^{}\n]+\}|\^\d+|_\d+)(?:\s*\\(?:times|cdot|div|pm|mp|leq|geq|neq|approx|equiv|to|rightarrow|leftarrow)\s*[A-Za-z0-9]+(?:\^\{[^{}\n]+\}|_\{[^{}\n]+\}|\^\d+|_\d+))+(?:\s*=\s*[A-Za-z0-9]+(?:\^\{[^{}\n]+\}|_\{[^{}\n]+\}|\^\d+|_\d+))?|[A-Za-z0-9]+(?:\^\{[^{}\n]+\}|_\{[^{}\n]+\}|\^\d+|_\d+))|\\(?:frac|dfrac|tfrac|binom)\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\}(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?|\\sqrt\s*(?:\[[^\]\n]*\]\s*)?\{(?:[^{}\n]|\{[^{}\n]*\})*\}|\\(?:sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|theta|alpha|beta|gamma|delta|pi|omega|times|cdot|div|pm|mp|leq|geq|neq|approx|equiv|to|rightarrow|leftarrow|text|mathrm|mathbf)\b(?:\s*\{(?:[^{}\n]|\{[^{}\n]*\})*\})?)/g

export function normalizeMathCommands(value = '') {
  return String(value ?? '')
    .replace(/\\timesimes\b/g, '\\times')
    .replace(/\t+imes(?:imes)?\b/g, '\\times')
    .replace(/\btimesimes\b/g, '\\times')
}

export function normalizeMathValue(value = '') {
  const text = normalizeMathCommands(value).trim()
  const withoutMarkers = text
    .replace(/^\$\$([\s\S]*?)\$\$$/, '$1')
    .replace(/^\$([^$]+)\$$/, '$1')
    .replace(/^\\\(([\s\S]*)\\\)$/, '$1')
    .replace(/^\\\[([\s\S]*)\\\]$/, '$1')
    .trim()

  if (!withoutMarkers) return ''

  const leadingCommandPattern = /^(frac|sqrt|sin|cos|tan|log|ln|csc|sec|cot|sum|prod|int|lim|dfrac|tfrac|binom|left|right|cdot|times|div|pm|mp|theta|alpha|beta|gamma|delta|pi|omega|root|text|mathrm|mathbf|overline|bar|vec|begin|displaystyle)/i
  if (leadingCommandPattern.test(withoutMarkers)) {
    return withoutMarkers.startsWith('\\') ? withoutMarkers : `\\${withoutMarkers}`
  }

  return withoutMarkers
}
