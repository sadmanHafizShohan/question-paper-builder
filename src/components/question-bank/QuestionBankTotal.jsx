import { useEffect, useState } from 'react'
import { BookOpen } from 'lucide-react'
import { bengaliNumber } from '../../shared/formatting.js'
import { countChangedEvent } from '../../shared/questionBankCountEvents.js'
import './QuestionBankTotal.css'

export default function QuestionBankTotal({ apiUrl, className = '' }) {
  const [count, setCount] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    let requestController

    async function loadCount() {
      requestController?.abort()
      requestController = new AbortController()
      try {
        const response = await fetch(`${apiUrl}/questions/count`, { signal: requestController.signal })
        if (!response.ok) throw new Error(`Question count API failed with HTTP ${response.status}`)
        const result = await response.json()
        if (!Number.isSafeInteger(result.total) || result.total < 0) {
          throw new Error('Question count API returned an invalid total')
        }
        if (active) {
          setCount(result.total)
          setError('')
        }
      } catch (loadError) {
        if (active && loadError.name !== 'AbortError') {
          console.error('Could not load the total question count', loadError)
          setCount(null)
          setError('প্রশ্নসংখ্যা লোড করা যায়নি')
        }
      }
    }

    const refreshOnFocus = () => { loadCount() }
    loadCount()
    const refreshInterval = window.setInterval(loadCount, 60_000)
    window.addEventListener('focus', refreshOnFocus)
    window.addEventListener(countChangedEvent, refreshOnFocus)

    return () => {
      active = false
      requestController?.abort()
      window.clearInterval(refreshInterval)
      window.removeEventListener('focus', refreshOnFocus)
      window.removeEventListener(countChangedEvent, refreshOnFocus)
    }
  }, [apiUrl])

  return (
    <div className={`question-bank-total ${className}`.trim()} role="status" aria-live="polite" title={error || undefined}>
      <span className="question-bank-total-icon"><BookOpen size={18} aria-hidden="true" /></span>
      <span className="question-bank-total-copy">
        <small>ডাটাবেজে মোট প্রশ্ন</small>
        <strong>{count === null ? error || 'লোড হচ্ছে…' : bengaliNumber(count)}</strong>
      </span>
    </div>
  )
}
