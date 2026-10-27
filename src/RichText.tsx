import type { ReactElement } from 'react'
import { Trans } from 'react-i18next'
import type { RichTag } from './richTags.ts'

/** Each allowed tag becomes a fixed React element with no attributes from the text; anything else stays plain text. */
const COMPONENTS: Record<RichTag, ReactElement> = {
  pin: <code className="pin-ref" />,
  v: <span className="bit" />,
  b: <strong />,
  i: <em />,
}

/** An already translated text with light markup; a blank line starts a new paragraph. */
export function RichText({ text }: { text: string }) {
  return text.split(/\n\s*\n/).map((paragraph, i) => (
    <p key={i}>
      <Trans defaults={paragraph} components={COMPONENTS} shouldUnescape={false} />
    </p>
  ))
}
