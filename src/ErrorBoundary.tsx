import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

function Fallback() {
  const { t } = useTranslation()
  return (
    <main className="crash" role="alert">
      <h1>{t('crash.title')}</h1>
      <p>{t('crash.body')}</p>
      <button type="button" className="primary" onClick={() => location.reload()}>
        {t('crash.reload')}
      </button>
    </main>
  )
}

/** A render error shows a way out instead of a blank page. Progress lives in localStorage, so reloading keeps it. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Render error', error, info.componentStack)
  }

  render() {
    return this.state.failed ? <Fallback /> : this.props.children
  }
}
