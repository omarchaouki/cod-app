import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  isValidMoroccanPhone,
  normalizePhone,
  orderInputSchema,
} from '../src/lib/validation.ts'

test('normalises every shape a Moroccan number gets typed in', () => {
  const expected = '0612345678'
  for (const input of [
    '0612345678',
    '06 12 34 56 78',
    '06-12-34-56-78',
    '06.12.34.56.78',
    '+212612345678',
    '00212612345678',
    '212612345678',
    '612345678',
    ' 0612345678 ',
    '(06) 12 34 56 78',
  ]) {
    assert.equal(normalizePhone(input), expected, `failed on ${input}`)
  }
})

test('normalises Arabic-Indic digits', () => {
  assert.equal(normalizePhone('٠٦١٢٣٤٥٦٧٨'), '0612345678')
  assert.equal(normalizePhone('۰۷۱۲۳۴۵۶۷۸'), '0712345678')
})

test('accepts 06 and 07 mobile prefixes', () => {
  assert.equal(isValidMoroccanPhone('0612345678'), true)
  assert.equal(isValidMoroccanPhone('0712345678'), true)
})

test('rejects numbers that are not Moroccan mobiles', () => {
  for (const input of [
    '0512345678', // landline prefix
    '061234567', // too short
    '06123456789', // too long
    '',
    'abcdefghij',
    '0012345678',
  ]) {
    assert.equal(isValidMoroccanPhone(input), false, `should reject ${input}`)
  }
})

const VALID_ORDER = {
  customer_name: 'محمد العلوي',
  phone: '06 12 34 56 78',
  address: 'مراكش، حي المسيرة 1، زنقة 12 رقم 45',
  quantity: 1,
  session_id: 'abc12345-def',
  idempotency_key: 'ord_12345678',
}

test('accepts a well-formed order and normalises the phone', () => {
  const result = orderInputSchema.safeParse(VALID_ORDER)
  assert.equal(result.success, true)
  assert.equal(result.data.phone, '0612345678')
})

test('the order schema carries no price field at all', () => {
  // The browser cannot influence money: any price it sends is dropped, and the
  // server reads the real one from the database.
  const result = orderInputSchema.safeParse({
    ...VALID_ORDER,
    price: '1.00',
    total_amount: '1.00',
    unit_price: '0.01',
  })

  assert.equal(result.success, true)
  assert.equal('price' in result.data, false)
  assert.equal('total_amount' in result.data, false)
  assert.equal('unit_price' in result.data, false)
})

test('rejects a short address', () => {
  const result = orderInputSchema.safeParse({ ...VALID_ORDER, address: 'مراكش' })
  assert.equal(result.success, false)
})

test('rejects a name with no letters', () => {
  const result = orderInputSchema.safeParse({ ...VALID_ORDER, customer_name: '123456' })
  assert.equal(result.success, false)
})

test('rejects a filled honeypot', () => {
  const result = orderInputSchema.safeParse({ ...VALID_ORDER, company: 'spam-bot' })
  assert.equal(result.success, false)
})

test('rejects a session id that could rewrite a PostgREST filter', () => {
  for (const session of ['abc,phone.eq.1', 'a(b)cdefgh', 'abc.def,ghi']) {
    const result = orderInputSchema.safeParse({ ...VALID_ORDER, session_id: session })
    assert.equal(result.success, false, `should reject ${session}`)
  }
})

test('caps the quantity so one request cannot book an absurd order', () => {
  assert.equal(orderInputSchema.safeParse({ ...VALID_ORDER, quantity: 21 }).success, false)
  assert.equal(orderInputSchema.safeParse({ ...VALID_ORDER, quantity: 0 }).success, false)
  assert.equal(orderInputSchema.safeParse({ ...VALID_ORDER, quantity: 20 }).success, true)
})
