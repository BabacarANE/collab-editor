import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { isGrantableRole, roleAllows } from '../../src/domain/roles'
import { normalizeTitle, validatePassword } from '../../src/domain/validation'
import { ValidationError } from '../../src/domain/errors'
import { toPrefixTsQuery } from '../../src/services/SearchService'

describe('politique des rôles', () => {
  test('matrice rôle × action', () => {
    assert.ok(roleAllows('VIEWER', 'read'))
    assert.ok(!roleAllows('VIEWER', 'comment'))
    assert.ok(roleAllows('COMMENTER', 'comment'))
    assert.ok(!roleAllows('COMMENTER', 'edit'))
    assert.ok(roleAllows('EDITOR', 'edit'))
    assert.ok(!roleAllows('EDITOR', 'manage'))
    assert.ok(roleAllows('OWNER', 'manage'))
    assert.ok(!roleAllows(null, 'read'))
  })

  test('OWNER ne peut pas être attribué', () => {
    assert.ok(isGrantableRole('EDITOR'))
    assert.ok(!isGrantableRole('OWNER'))
    assert.ok(!isGrantableRole(42))
  })
})

describe('validation', () => {
  test('titre', () => {
    assert.equal(normalizeTitle(undefined), 'Sans titre')
    assert.equal(normalizeTitle('  Plan  '), 'Plan')
    assert.throws(() => normalizeTitle('x'.repeat(256)), ValidationError)
    assert.throws(() => normalizeTitle(undefined, { required: true }), ValidationError)
  })

  test('mot de passe', () => {
    assert.throws(() => validatePassword('court'), ValidationError)
    assert.equal(validatePassword('suffisamment-long'), 'suffisamment-long')
  })
})

describe('requête de recherche', () => {
  test('préfixes et neutralisation des opérateurs', () => {
    assert.equal(toPrefixTsQuery('road ma'), 'road:* & ma:*')
    assert.equal(toPrefixTsQuery("a' & !b | (c:*"), 'a:* & b:* & c:*')
    assert.equal(toPrefixTsQuery('!!! ???'), null)
    assert.equal(toPrefixTsQuery('été réunion'), 'été:* & réunion:*')
  })
})
