import { useEffect, useState } from 'react'

export default function MathMarkup({ value, displayMode = false, className, fallbackClassName }) {
  const [markup, setMarkup] = useState('')

  useEffect(() => {
    let active = true
    import('mathlive').then(({ convertLatexToMarkup }) => {
      const latex = displayMode ? `\\displaystyle ${value}` : value
      if (active) setMarkup(convertLatexToMarkup(latex, { defaultMode: 'math' }))
    }).catch((error) => {
      console.error('Could not render a math expression', error)
      if (active) setMarkup('')
    })
    return () => { active = false }
  }, [value, displayMode])

  if (!markup) return <span className={fallbackClassName}>{value}</span>
  return <span className={className} dangerouslySetInnerHTML={{ __html: markup }} />
}
