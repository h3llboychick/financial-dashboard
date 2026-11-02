import test from 'node:test'
import assert from 'node:assert/strict'
import { transferDestinations } from './walletUtils.js'

const wallets = [
  { id: 1, name: 'Cash', type: 'fiat', currency: 'EUR' },
  { id: 2, name: 'Bank', type: 'fiat', currency: 'EUR' },
  { id: 3, name: 'Dollars', type: 'fiat', currency: 'USD' },
  { id: 4, name: 'Kraken', type: 'exchange', currency: 'EUR' },
]

test('offers only fiat wallets in the same currency, without the source', () => {
  assert.deepEqual(transferDestinations(wallets, 1).map(w => w.name), ['Bank'])
})

test('accepts the source id as a string from a select element', () => {
  assert.deepEqual(transferDestinations(wallets, '2').map(w => w.name), ['Cash'])
})

test('returns nothing when the source wallet is unknown or missing', () => {
  assert.deepEqual(transferDestinations(wallets, 99), [])
  assert.deepEqual(transferDestinations(wallets, ''), [])
  assert.deepEqual(transferDestinations(undefined, 1), [])
})

test('returns nothing when no other wallet shares the currency', () => {
  assert.deepEqual(transferDestinations(wallets, 3), [])
})
