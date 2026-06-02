import { createContext, useContext, useState, useEffect } from 'react'
import { themes } from '../lib/theme'

const ThemeCtx = createContext(null)

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(() => localStorage.getItem('ct_theme') === 'dark')

  useEffect(() => {
    document.documentElement.style.background = dark ? themes.dark.bgPage : themes.light.bgPage
  }, [dark])

  const toggleDark = () => {
    setDark(d => {
      const next = !d
      localStorage.setItem('ct_theme', next ? 'dark' : 'light')
      return next
    })
  }

  return (
    <ThemeCtx.Provider value={{ t: dark ? themes.dark : themes.light, dark, toggleDark }}>
      {children}
    </ThemeCtx.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeCtx)
}
