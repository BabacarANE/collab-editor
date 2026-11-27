import { useEffect, useRef } from 'react'

// Révèle une fois (classe .is-in) les éléments .reveal d'un conteneur quand ils entrent dans le viewport.
// Sans IntersectionObserver, ou avec « mouvement réduit », tout est affiché d'emblée.
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)

  useEffect(() => {
    const root = ref.current
    if (!root) return
    const items = Array.from(root.querySelectorAll<HTMLElement>('.reveal'))
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      items.forEach(el => el.classList.add('is-in'))
      return
    }
    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in')
          io.unobserve(entry.target)
        }
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 })
    items.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])

  return ref
}
