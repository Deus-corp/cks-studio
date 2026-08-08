import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingSpinner } from '../components/common/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders without crashing', () => {
    const { container } = render(<LoadingSpinner />)
    expect(container.firstChild).toBeDefined()
  })
})
