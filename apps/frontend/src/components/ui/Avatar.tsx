import { colorFor, initials } from '../../lib/format'

interface Props {
  email: string
  id?: string
  color?: string
  size?: number
  ring?: boolean
}

export function Avatar({ email, id, color, size = 28, ring }: Props) {
  const bg = color ?? colorFor(id ?? email)
  return (
    <span
      title={email}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${ring ? 'ring-2 ring-surface' : ''}`}
      style={{ width: size, height: size, background: bg, fontSize: Math.round(size * 0.38) }}
    >
      {initials(email)}
    </span>
  )
}
