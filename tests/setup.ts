// Copyright (c) 2025 Deus Corp. Licensed under MIT.

// Подключает jest-dom матчеры (toBeInTheDocument, toHaveTextContent, ...)
// для всех тестов через @testing-library/react. Зависимость
// @testing-library/jest-dom уже стояла в package.json, но нигде не была
// подключена — до этого коммита тесты могли использовать только базовые
// vitest-матчеры.
import '@testing-library/jest-dom/vitest'
