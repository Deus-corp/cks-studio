// Copyright (c) 2025 Deus Corp. Licensed under MIT.

// Подключает jest-dom матчеры (toBeInTheDocument, toHaveTextContent, ...)
// для всех тестов через @testing-library/react. Зависимость
// @testing-library/jest-dom уже стояла в package.json, но нигде не была
// подключена — до этого коммита тесты могли использовать только базовые
// vitest-матчеры.
import '@testing-library/jest-dom/vitest'

// vitest.config.ts не включает test.globals, поэтому автоматическая
// afterEach-очистка DOM из @testing-library/react (которая полагается на
// глобальный afterEach) не регистрируется сама по себе — без этого разные
// it() внутри одного файла накапливают смонтированные деревья в
// document.body, и getByRole/getByText начинают падать с "multiple
// elements found" при рендере одного компонента в нескольких тестах.
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
