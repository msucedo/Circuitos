import { ChevronIcon } from './icons.tsx'
import { play } from './sound.ts'

interface Props {
  collapsed: boolean
  /** Id of the element it shows and hides. */
  controls: string
  showLabel: string
  hideLabel: string
  onToggle: () => void
}

/** Folds a side column; hidden on a phone, where the columns have another layout. */
export function CollapseToggle({ collapsed, controls, showLabel, hideLabel, onToggle }: Props) {
  const label = collapsed ? showLabel : hideLabel
  return (
    <button type="button" className="icon-button collapse-toggle" aria-expanded={!collapsed} aria-controls={controls} aria-label={label} title={label} onClick={() => {
        play(collapsed ? 'unfold' : 'fold')
        onToggle()
      }}>
      <ChevronIcon />
    </button>
  )
}
