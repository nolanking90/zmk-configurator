import { test } from 'vitest'
import { compileKeymap } from './compile'
import { kitchenSinkLayout } from './fixtures/kitchenSink'
import { getKeyboard } from '../data/keyboards'
test('print', () => {
  const r = compileKeymap(kitchenSinkLayout(), getKeyboard('corne')!)
  console.log(r.keymap.replace(/\/\* zmk-configurator:.*\*\//, '')); console.log(r.conf); console.log(r.centralConf); console.log(r.warnings)
})
