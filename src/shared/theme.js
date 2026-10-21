import { useEffect, useState } from 'react'

const themeStorageKey = 'question-builder-theme'
const themeEventName = 'question-builder-theme-change'

export function useThemeMode() {
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem(themeStorageKey) === 'dark')

  useEffect(() => {
    const theme = darkMode ? 'dark' : 'light'
    document.documentElement.dataset.theme = theme
    localStorage.setItem(themeStorageKey, theme)
    window.dispatchEvent(new CustomEvent(themeEventName, { detail: theme }))
  }, [darkMode])

  useEffect(() => {
    const synchronizeTheme = (event) => {
      const theme = event.detail ?? localStorage.getItem(themeStorageKey)
      setDarkMode(theme === 'dark')
    }
    const synchronizeStorage = (event) => {
      if (event.key === themeStorageKey) setDarkMode(event.newValue === 'dark')
    }
    window.addEventListener(themeEventName, synchronizeTheme)
    window.addEventListener('storage', synchronizeStorage)
    return () => {
      window.removeEventListener(themeEventName, synchronizeTheme)
      window.removeEventListener('storage', synchronizeStorage)
    }
  }, [])

  return [darkMode, setDarkMode]
}
