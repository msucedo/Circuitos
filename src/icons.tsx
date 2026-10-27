import type { ReactNode } from 'react'

/** The app icon: a NAND gate with its output lit. public/favicon.svg is the same drawing. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7" fill="#181c24" stroke="#2a303c" />
      <g stroke="#7aa2ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 12h6M3 20h6" />
        <path d="M9 8h4a8 8 0 0 1 0 16H9z" />
        <circle cx="23" cy="16" r="2" />
      </g>
      <path d="M25 16h4" stroke="#4ade80" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      className="icon"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export const LockIcon = () => (
  <Icon>
    <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </Icon>
)

export const CheckIcon = () => (
  <Icon>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
)

export const UndoIcon = () => (
  <Icon>
    <path d="M4 6h6a3.5 3.5 0 0 1 0 7H6M6.5 3.5L4 6l2.5 2.5" />
  </Icon>
)

export const RedoIcon = () => (
  <Icon>
    <path d="M12 6H6a3.5 3.5 0 0 0 0 7h4M9.5 3.5L12 6 9.5 8.5" />
  </Icon>
)

export const CopyIcon = () => (
  <Icon>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M3 10.5V4a1 1 0 0 1 1-1h6.5" />
  </Icon>
)

export const PasteIcon = () => (
  <Icon>
    <rect x="3.5" y="3" width="9" height="11" rx="1.5" />
    <rect x="6" y="1.5" width="4" height="3" rx="1" />
  </Icon>
)

export const TrashIcon = () => (
  <Icon>
    <path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.7 9h5.6l.7-9" />
  </Icon>
)

export const TableIcon = () => (
  <Icon>
    <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
    <path d="M2.5 6.5h11M7 6.5V13" />
  </Icon>
)

export const StepIcon = () => (
  <Icon>
    <path d="M4 3.5v9M7 3.5l5 4.5-5 4.5z" />
  </Icon>
)

/** Points left: "fold towards the edge". CSS turns it around while folded. */
export const ChevronIcon = () => (
  <Icon>
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </Icon>
)

export const BookIcon = () => (
  <Icon>
    <path d="M8 4.5C6.5 3.3 4.5 3 2.5 3.2v9.3c2-.2 4 .1 5.5 1.3 1.5-1.2 3.5-1.5 5.5-1.3V3.2c-2-.2-4 .1-5.5 1.3zM8 4.5v9.3" />
  </Icon>
)

export const HelpIcon = () => (
  <Icon>
    <path d="M5.75 6a2.25 2.25 0 1 1 3.3 2c-.6.32-1.05.8-1.05 1.5v.5M8 12.25v.01" />
  </Icon>
)
