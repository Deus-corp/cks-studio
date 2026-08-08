// Copyright (c) 2025 Deus Corp. Licensed under MIT.

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  error: Error | null
}

/**
 * Ловит ошибки рендера в поддереве (например, если серверный ответ имеет
 * неожиданную форму и падает где-то в глубине графа/панелей) и показывает
 * fallback вместо белого экрана. Оборачивает <Routes> в App.tsx.
 *
 * Намеренно class-компонент — это единственный способ реализовать error
 * boundary в React (хуков-эквивалента нет).
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('CKS Studio crashed:', error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    const { error } = this.state
    if (!error) {
      return this.props.children
    }

    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h2 className="text-lg font-semibold text-red-400">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-400 break-words">{error.message}</p>
          <button
            type="button"
            onClick={this.handleReset}
            className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 px-3 py-1.5 rounded"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }
}
