import { useEffect, useId, useRef, useState } from 'react'
import './KidSelect.css'

export default function KidSelect({
  label,
  labelIcon,
  options,
  value,
  onChange,
  placeholder = 'একটি অপশন বেছে নিন',
  disabled = false,
  showMissionBubble = false,
}) {
  const generatedId = useId()
  const listboxId = `${generatedId}-listbox`
  const rootRef = useRef(null)
  const triggerRef = useRef(null)
  const optionRefs = useRef([])
  const [open, setOpen] = useState(false)
  const selectedIndex = options.findIndex((option) => String(option.value) === String(value))
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex))

  useEffect(() => {
    if (!open) return undefined
    const animationFrame = window.requestAnimationFrame(() => {
      const option = optionRefs.current[activeIndex]
      option?.focus()
      option?.scrollIntoView({ block: 'nearest' })
    })
    return () => window.cancelAnimationFrame(animationFrame)
  }, [open, activeIndex])

  useEffect(() => {
    function closeOnOutsidePointer(event) {
      if (open && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer)
  }, [open])

  function openList(index = selectedIndex >= 0 ? selectedIndex : 0) {
    if (disabled || options.length === 0) return
    setActiveIndex(Math.max(0, Math.min(index, options.length - 1)))
    setOpen(true)
  }

  function closeList({ returnFocus = false } = {}) {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }

  function selectOption(option) {
    onChange(option.value)
    closeList({ returnFocus: true })
  }

  function handleTriggerKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      openList(selectedIndex >= 0 ? (selectedIndex + 1) % options.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      openList(selectedIndex >= 0 ? (selectedIndex - 1 + options.length) % options.length : options.length - 1)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      closeList({ returnFocus: true })
    }
  }

  function handleOptionKeyDown(event, index) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((index + direction + options.length) % options.length)
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      setActiveIndex(event.key === 'Home' ? 0 : options.length - 1)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      selectOption(options[index])
    } else if (event.key === 'Escape') {
      event.preventDefault()
      closeList({ returnFocus: true })
    } else if (event.key === 'Tab') {
      closeList()
    }
  }

  return (
    <div className={`kid-select${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`} ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className="kid-select-trigger"
        role="button"
        aria-label={`${label}: ${selectedOption?.label ?? placeholder}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => (open ? closeList() : openList())}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="kid-select-option-icon" style={{ '--option-color': selectedOption?.color || '#c4b5fd' }} aria-hidden="true">
          {selectedOption?.icon || labelIcon}
        </span>
        <span className={`kid-select-trigger-label${selectedOption ? '' : ' is-placeholder'}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <span className={`kid-select-chevron${open ? ' is-rotated' : ''}`} aria-hidden="true">⌄</span>
      </button>
      <div
        id={listboxId}
        className={`kid-select-listbox${open ? ' is-visible' : ' is-closing'}`}
        role="listbox"
        aria-label={`${label} নির্বাচন করুন`}
        aria-hidden={!open}
        inert={!open}
      >
        {options.map((option, index) => {
          const selected = index === selectedIndex
          return <div
            key={String(option.value)}
            ref={(element) => { optionRefs.current[index] = element }}
            className={`kid-select-option${selected ? ' is-selected' : ''}${index === activeIndex ? ' is-active' : ''}`}
            role="option"
            aria-selected={selected}
            tabIndex={-1}
            onFocus={() => setActiveIndex(index)}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectOption(option)}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
          >
            <span className="kid-select-option-icon" style={{ '--option-color': option.color || '#c4b5fd' }} aria-hidden="true">
              {option.icon || labelIcon}
            </span>
            <span className="kid-select-option-label">{option.label}</span>
            {selected && <span className="kid-select-check" aria-hidden="true">✔</span>}
          </div>
        })}
      </div>
    </div>
  )
}
