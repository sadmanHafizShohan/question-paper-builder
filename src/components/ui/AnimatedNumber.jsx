import { useEffect, useRef, useState } from 'react'

const formatNumber = (value) => Math.round(value).toLocaleString('bn-BD')

export default function AnimatedNumber({ value, active = true }) {
  const target = Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0
  const [displayValue, setDisplayValue] = useState(0)
  const currentValue = useRef(0)

  useEffect(() => {
    if (!active) {
      currentValue.current = 0
      return undefined
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startValue = currentValue.current
    const difference = target - startValue
    if (difference === 0) return undefined

    const duration = reducedMotion ? 0 : 900
    let animationFrame
    let startTime

    const animate = (timestamp) => {
      if (startTime === undefined) startTime = timestamp
      const progress = duration === 0 ? 1 : Math.min((timestamp - startTime) / duration, 1)
      const easedProgress = 1 - (1 - progress) ** 3
      const nextValue = Math.round(startValue + difference * easedProgress)
      currentValue.current = nextValue
      setDisplayValue(nextValue)
      if (progress < 1) animationFrame = window.requestAnimationFrame(animate)
    }

    animationFrame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(animationFrame)
  }, [active, target])

  return <span aria-label={formatNumber(target)}>{formatNumber(active ? displayValue : 0)}</span>
}