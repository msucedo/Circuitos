import { useEffect, useRef, useState } from 'react'
import { Logo } from './icons.tsx'

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl'

const SHORTCUTS: [keys: string[], action: string][] = [
  [[MOD, 'Z'], 'Deshacer'],
  [[MOD, 'Shift', 'Z'], 'Rehacer'],
  [[MOD, 'C'], 'Copiar lo seleccionado'],
  [[MOD, 'V'], 'Pegar (también en otro nivel)'],
  [['Supr'], 'Borrar lo seleccionado (o Backspace)'],
  [[MOD, 'clic'], 'Seleccionar varias piezas'],
  [['Arrastrar'], 'En el lienzo vacío, seleccionar con un recuadro'],
  [['Espacio', 'arrastrar'], 'Mover el lienzo (también con scroll)'],
  [[MOD, 'scroll'], 'Acercar o alejar (o pellizcar en el trackpad)'],
  [['Doble clic'], 'Renombrar una entrada o salida (Modo libre)'],
]

export const AUTHOR_URL = 'https://github.com/msucedo'

export function Credit({ className }: { className?: string }) {
  return (
    <p className={className}>
      Hecho por{' '}
      <a href={AUTHOR_URL} target="_blank" rel="noopener noreferrer">
        msucedo
      </a>
    </p>
  )
}

interface Props {
  open: boolean
  hasProgress: boolean
  onClose: () => void
  onResetAll: () => void
}

/** Native modal dialog: the browser traps focus, closes it on Esc and hides the page behind it. */
export function Welcome({ open, hasProgress, onClose, onResetAll }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  return (
    <dialog
      ref={dialog}
      className="welcome"
      aria-labelledby="welcome-title"
      onClose={() => {
        setConfirmReset(false)
        onClose()
      }}
    >
      <div className="welcome-title">
        <Logo size={36} />
        <h2 id="welcome-title">Circuitos</h2>
      </div>
      <p>Arma una computadora empezando por una sola compuerta NAND.</p>

      <h3>Cómo se juega</h3>
      <ol>
        <li>Cada nivel te dice qué debe hacer el chip que vas a armar.</li>
        <li>Conecta piezas en el lienzo y pulsa Probar.</li>
        <li>Si pasa, el chip queda en tu paleta para los siguientes niveles.</li>
      </ol>
      <p>En Modo libre puedes armar lo que quieras con lo que ya desbloqueaste.</p>

      <h3>Tu progreso</h3>
      <p>
        No necesitas cuenta. Todo se guarda solo en este navegador. Si borras los datos del sitio o cambias de navegador o
        de equipo, empiezas de cero. Para llevarte un circuito usa Exportar.
      </p>

      <h3>Atajos</h3>
      <dl className="shortcuts">
        {SHORTCUTS.map(([keys, action]) => (
          <div key={action}>
            <dt>
              {keys.map((k) => (
                <kbd key={k}>{k}</kbd>
              ))}
            </dt>
            <dd>{action}</dd>
          </div>
        ))}
      </dl>

      <div className="actions">
        <button type="button" className="primary" autoFocus onClick={onClose}>
          {hasProgress ? 'Continuar' : 'Empezar'}
        </button>
        {hasProgress && (
          <button
            type="button"
            className={confirmReset ? 'danger' : ''}
            onClick={() => (confirmReset ? onResetAll() : setConfirmReset(true))}
          >
            {confirmReset ? '¿Seguro? Borrar todo' : 'Borrar mi progreso'}
          </button>
        )}
      </div>

      <Credit className="credit" />
    </dialog>
  )
}
