import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  addCentimes,
  formatMoney,
  fromCentimes,
  multiplyCentimes,
  ratio,
  toCentimes,
} from '../src/lib/money.ts'

test('parses exact decimal strings from Postgres numeric', () => {
  assert.equal(toCentimes('149.00'), 14900)
  assert.equal(toCentimes('149'), 14900)
  assert.equal(toCentimes('0.05'), 5)
  assert.equal(toCentimes('0.5'), 50)
  assert.equal(toCentimes('1234567.89'), 123456789)
  assert.equal(toCentimes('-25.50'), -2550)
})

test('treats empty and missing values as zero', () => {
  assert.equal(toCentimes(null), 0)
  assert.equal(toCentimes(undefined), 0)
  assert.equal(toCentimes(''), 0)
})

test('accepts a comma decimal separator', () => {
  assert.equal(toCentimes('149,50'), 14950)
})

test('round-trips through the Postgres decimal format', () => {
  for (const value of ['0.00', '1.05', '99.99', '149.00', '10000.01']) {
    assert.equal(fromCentimes(toCentimes(value)), value)
  }
})

test('pads the fractional part correctly', () => {
  assert.equal(fromCentimes(5), '0.05')
  assert.equal(fromCentimes(50), '0.50')
  assert.equal(fromCentimes(14900), '149.00')
  assert.equal(fromCentimes(-2550), '-25.50')
})

test('addition is exact where floating point is not', () => {
  // 0.1 + 0.2 !== 0.3 in binary floating point; in centimes it is exact.
  const sum = addCentimes(toCentimes('0.10'), toCentimes('0.20'))
  assert.equal(sum, 30)
  assert.equal(fromCentimes(sum), '0.30')

  // A hundred orders at 149.99 must not drift by a single centime.
  let total = 0
  for (let i = 0; i < 100; i += 1) total += toCentimes('149.99')
  assert.equal(fromCentimes(total), '14999.00')
})

test('multiplies by quantity without drift', () => {
  assert.equal(multiplyCentimes(toCentimes('149.99'), 3), 44997)
  assert.equal(fromCentimes(multiplyCentimes(toCentimes('33.33'), 3)), '99.99')
})

test('formats money for display', () => {
  assert.equal(formatMoney(14900, { currency: 'MAD' }), '149 MAD')
  assert.equal(formatMoney(14950, { currency: 'MAD' }), '149.50 MAD')
  assert.equal(formatMoney(2475000, { currency: 'MAD' }), '24,750 MAD')
  assert.equal(formatMoney(14900, { currency: '' }), '149')
})

test('ratio guards against division by zero', () => {
  assert.equal(ratio(5, 0), 0)
  assert.equal(ratio(0, 0), 0)
  assert.equal(ratio(55, 100), 0.55)
})
