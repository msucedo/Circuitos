/** The only tags translations may use; RichText maps each one to a fixed element. */
export const RICH_TAGS = ['pin', 'v', 'b', 'i'] as const
export type RichTag = (typeof RICH_TAGS)[number]
