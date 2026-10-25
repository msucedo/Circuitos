export const HISTORY_LIMIT = 100

/** Undo/redo stacks of snapshots; `record` is called with the state before each change. */
export class History<T> {
  private past: T[] = []
  private future: T[] = []
  private readonly limit: number

  constructor(limit = HISTORY_LIMIT) {
    this.limit = limit
  }

  record(before: T) {
    this.past.push(before)
    if (this.past.length > this.limit) this.past.shift()
    this.future = []
  }

  undo(current: T): T | undefined {
    const previous = this.past.pop()
    if (previous !== undefined) this.future.push(current)
    return previous
  }

  redo(current: T): T | undefined {
    const next = this.future.pop()
    if (next !== undefined) this.past.push(current)
    return next
  }

  get canUndo() {
    return this.past.length > 0
  }

  get canRedo() {
    return this.future.length > 0
  }
}
