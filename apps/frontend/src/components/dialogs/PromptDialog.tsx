import { useState } from 'react'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  title: string
  label: string
  placeholder?: string
  initialValue?: string
  confirmLabel: string
  validate?: (value: string) => string | null
  onConfirm: (value: string) => Promise<void> | void
  onClose: () => void
}

// Saisie d'une valeur dans une modale (remplace window.prompt)
export default function PromptDialog({
  title, label, placeholder, initialValue = '', confirmLabel, validate, onConfirm, onClose
}: Props) {
  const [value, setValue] = useState(initialValue)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim()
    const problem = validate ? validate(trimmed) : (trimmed ? null : 'Ce champ est requis')
    if (problem) return setError(problem)
    setBusy(true)
    try {
      await onConfirm(trimmed)
      onClose()
    } catch {
      setError('Une erreur est survenue')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title={title} onClose={onClose} width="max-w-md">
      <form onSubmit={submit}>
        <label className="mb-1.5 block text-sm font-medium text-ink-soft">{label}</label>
        <input
          autoFocus
          value={value}
          onChange={e => { setValue(e.target.value); setError('') }}
          placeholder={placeholder}
          className="h-10 w-full rounded-md border border-line-strong px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        />
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={busy}>{confirmLabel}</Button>
        </div>
      </form>
    </Modal>
  )
}
