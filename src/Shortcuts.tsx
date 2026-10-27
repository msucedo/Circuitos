import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import type es from './locales/es.json'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

type KeyName = keyof (typeof es)['welcome']['keys']
type ActionName = keyof (typeof es)['welcome']['actions']

/** Literal keys stay as they are; named ones (`{ name }`) are translated. */
const SHORTCUTS: [keys: (string | { name: KeyName })[], action: ActionName][] = [
  [[MOD, 'Z'], 'undo'],
  [[MOD, 'Shift', 'Z'], 'redo'],
  [[MOD, 'C'], 'copy'],
  [[MOD, 'V'], 'paste'],
  [[{ name: 'delete' }], 'delete'],
  [[MOD, { name: 'click' }], 'multiSelect'],
  [[{ name: 'drag' }], 'boxSelect'],
  [[{ name: 'space' }, { name: 'dragLower' }], 'pan'],
  [[MOD, { name: 'scroll' }], 'zoom'],
  [[{ name: 'doubleClick' }], 'rename'],
]

const keyLabel = (t: TFunction, key: string | { name: KeyName }) => (typeof key === 'string' ? key : t(`welcome.keys.${key.name}`))

/** The keyboard and mouse shortcuts; shown in the welcome and in the guide. */
export function Shortcuts() {
  const { t } = useTranslation()
  return (
    <dl className="shortcuts">
      {SHORTCUTS.map(([keys, action]) => (
        <div key={action}>
          <dt>
            {keys.map((k, i) => (
              <kbd key={i}>{keyLabel(t, k)}</kbd>
            ))}
          </dt>
          <dd>{t(`welcome.actions.${action}`)}</dd>
        </div>
      ))}
    </dl>
  )
}
