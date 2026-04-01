import { describe, it } from 'vitest'

// Will import PipelineStepper and render with @testing-library/react
// once Plan 02 creates the component.

describe('PipelineStepper', () => {
  it.todo('renders all 5 stage labels')
  it.todo('marks current stage with current visual style')
  it.todo('marks completed stages with check icon')
  it.todo('marks skipped stages with warning icon')
  it.todo('calls onStageClick when a navigable stage is clicked')
  it.todo('does not call onStageClick for non-navigable stages')
})
