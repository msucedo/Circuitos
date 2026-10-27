import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { kindName } from './editor/context.ts'
import es from './locales/es.json'
import { RichText } from './RichText.tsx'
import { Shortcuts } from './Shortcuts.tsx'
import { useDialog } from './useDialog.ts'

/** The Spanish texts set which entries exist; the tests keep English with the same keys. */
const CONCEPTS = Object.keys(es.guide.concepts.items)
const PIECES = Object.keys(es.guide.pieces.items)
type Command = keyof (typeof es)['guide']['commands']['items']

/** Each command with the label it has on screen, so the guide always names it the same way. */
const COMMANDS: [command: Command, label: string][] = [
  ['test', 'app.test'],
  ['showHint', 'app.showHint'],
  ['reset', 'app.reset'],
  ['table', 'editor.table'],
  ['theory', 'editor.theory'],
  ['stepMode', 'editor.stepMode'],
  ['pauseClock', 'editor.pauseClock'],
  ['bits', 'editor.bits'],
  ['export', 'app.export'],
  ['saveChip', 'app.saveChip'],
  ['fold', 'guide.foldLabel'],
]

const SECTIONS = ['howTo', 'concepts', 'pieces', 'commands', 'shortcuts'] as const
type Section = (typeof SECTIONS)[number]
const sectionId = (section: string) => `guide-${section}`
/** A section counts as the one being read once its title is this close to the top of the content. */
const READING_OFFSET_PX = 32
/** After a click on the index, scrolling is ours until it ends; browsers without `scrollend` give up after this. */
const JUMP_MS = 1000

/** Keys built at run time; the typed `t` only knows literal ones. */
const text = (t: TFunction, key: string) => t(key as 'guide.title')

interface Props {
  open: boolean
  onClose: () => void
}

/** Everything the game uses, to look up while playing: how to solve, concepts, pieces and commands. */
export function Guide({ open, onClose }: Props) {
  // The content takes the focus on opening, so the keyboard scrolls it right away.
  const content = useRef<HTMLDivElement>(null)
  const { dialog, shown } = useDialog(open, onClose, content)

  return (
    <dialog ref={dialog} className="guide" aria-labelledby="guide-title" onClose={onClose}>
      {/* Built only while shown: it is long and nobody reads it closed. */}
      {shown && <GuideContent content={content} onClose={onClose} />}
    </dialog>
  )
}

function GuideContent({ content, onClose }: { content: RefObject<HTMLDivElement | null>; onClose: () => void }) {
  const { t } = useTranslation()
  const [reading, setReading] = useState<Section>(SECTIONS[0])
  const jumping = useRef<ReturnType<typeof setTimeout>>(undefined)

  // The index marks the section being read: the last one whose title has reached the top, or the
  // last section once the end is reached (it may be too short to ever reach the top).
  useEffect(() => {
    const el = content.current
    if (!el) return
    const update = () => {
      if (jumping.current) return
      const top = el.getBoundingClientRect().top + READING_OFFSET_PX
      const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
      const passed = SECTIONS.filter((s) => (document.getElementById(sectionId(s))?.getBoundingClientRect().top ?? Infinity) <= top)
      setReading(atEnd ? SECTIONS[SECTIONS.length - 1] : (passed.at(-1) ?? SECTIONS[0]))
    }
    // The jump ended: mark wherever it landed (it may be a later section when the end is reached).
    const release = () => {
      clearTimeout(jumping.current)
      jumping.current = undefined
      update()
    }
    el.addEventListener('scroll', update, { passive: true })
    el.addEventListener('scrollend', release)
    return () => {
      clearTimeout(jumping.current)
      el.removeEventListener('scroll', update)
      el.removeEventListener('scrollend', release)
    }
  }, [content])

  const jump = (section: Section) => {
    setReading(section)
    clearTimeout(jumping.current)
    jumping.current = setTimeout(() => content.current?.dispatchEvent(new Event('scrollend')), JUMP_MS)
    document.getElementById(sectionId(section))?.scrollIntoView({ block: 'start' })
  }

  return (
    <>
      <header className="guide-head">
        <h2 id="guide-title">{t('guide.title')}</h2>
        <button type="button" aria-label={t('guide.close')} onClick={onClose}>
          ×
        </button>
      </header>
      <div className="guide-body">
        <nav className="guide-index" aria-label={t('guide.index')}>
          <ol>
            {SECTIONS.map((section) => (
              <li key={section}>
                <button type="button" aria-current={reading === section} onClick={() => jump(section)}>
                  {text(t, `guide.${section}.title`)}
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="guide-content" ref={content} tabIndex={-1}>
          <section id={sectionId('howTo')} aria-labelledby="guide-howTo-title">
            <h3 id="guide-howTo-title">{t('guide.howTo.title')}</h3>
            <RichText text={t('guide.howTo.body')} />
          </section>
          <section id={sectionId('concepts')} aria-labelledby="guide-concepts-title">
            <h3 id="guide-concepts-title">{t('guide.concepts.title')}</h3>
            <dl className="glossary">
              {CONCEPTS.map((id) => (
                <div key={id}>
                  <dt>{text(t, `guide.concepts.items.${id}.term`)}</dt>
                  <dd>
                    <RichText text={text(t, `guide.concepts.items.${id}.text`)} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section id={sectionId('pieces')} aria-labelledby="guide-pieces-title">
            <h3 id="guide-pieces-title">{t('guide.pieces.title')}</h3>
            <p>{t('guide.pieces.intro')}</p>
            <dl className="glossary">
              {PIECES.map((kind) => (
                <div key={kind}>
                  <dt>{kindName(t, kind, new Map())}</dt>
                  <dd>
                    <RichText text={text(t, `guide.pieces.items.${kind}`)} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section id={sectionId('commands')} aria-labelledby="guide-commands-title">
            <h3 id="guide-commands-title">{t('guide.commands.title')}</h3>
            <dl className="glossary">
              {COMMANDS.map(([command, label]) => (
                <div key={command}>
                  <dt>{text(t, label)}</dt>
                  <dd>
                    <RichText text={t(`guide.commands.items.${command}`)} />
                  </dd>
                </div>
              ))}
            </dl>
          </section>
          <section id={sectionId('shortcuts')} aria-labelledby="guide-shortcuts-title">
            <h3 id="guide-shortcuts-title">{t('guide.shortcuts.title')}</h3>
            <Shortcuts />
          </section>
        </div>
      </div>
    </>
  )
}
