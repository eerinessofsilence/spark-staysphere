import { describe, expect, it } from 'vitest'
import { includedModules, optionalModules, PMS_MODULES } from './modules'

describe('plan module allowances', () => {
  it.each([
    ['independent', 'starter'],
    ['boutique', 'growth'],
    ['group', 'scale'],
  ] as const)('splits included and optional modules for %s', (plan, tier) => {
    const included = includedModules(plan)
    const optional = optionalModules(plan)
    expect(included.every((module) => module.includedIn.includes(tier))).toBe(true)
    expect(optional.every((module) => !module.includedIn.includes(tier))).toBe(true)
    expect([...included, ...optional].map((module) => module.id).sort()).toEqual(PMS_MODULES.map((module) => module.id).sort())
    expect(new Set([...included, ...optional].map((module) => module.id)).size).toBe(PMS_MODULES.length)
  })
})
