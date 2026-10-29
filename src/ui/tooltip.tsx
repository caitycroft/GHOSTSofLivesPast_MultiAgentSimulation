import { useSyncExternalStore, type ReactNode } from 'react'

// One floating tooltip for the whole piece. Receipts live here (PRD 4.2, idea 7).
interface Tip { x: number; y: number; content: ReactNode }
let tip: Tip | null = null
const ls = new Set<() => void>()
export const showTip = (x: number, y: number, content: ReactNode) => { tip = { x, y, content }; ls.forEach((l) => l()) }
export const hideTip = () => { if (tip) { tip = null; ls.forEach((l) => l()) } }

export function Tooltip() {
  const t = useSyncExternalStore((l) => { ls.add(l); return () => ls.delete(l) }, () => tip)
  if (!t) return null
  const left = Math.min(t.x + 16, window.innerWidth - 340)
  const top = Math.min(t.y + 16, window.innerHeight - 220)
  return <div className="tooltip" style={{ left, top }}>{t.content}</div>
}

export function Receipts({ items }: { items: { label: string; source: string; url: string }[] }) {
  return (
    <div className="receipts">
      {items.map((r, i) => (
        <div key={i} className="receipt">
          <div>{r.label}</div>
          <div className="src">{r.source}</div>
        </div>
      ))}
    </div>
  )
}
