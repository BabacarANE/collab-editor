import { create } from 'zustand'
import { safeStorage } from '../lib/format'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'collab:theme'
const storage = safeStorage()

function readChoice(): ThemeChoice {
  const v = storage.get(KEY)
  return v === 'light' || v === 'dark' ? v : 'system'
}

// « system » retire l'attribut : tokens.css suit alors prefers-color-scheme
function apply(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

interface ThemeState {
  choice: ThemeChoice
  setChoice: (choice: ThemeChoice) => void
}

export const useThemeStore = create<ThemeState>(set => ({
  choice: readChoice(),
  setChoice: choice => {
    storage.set(KEY, choice)
    apply(choice)
    set({ choice })
  },
}))
