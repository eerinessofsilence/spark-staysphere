import { describe, expect, it } from 'vitest'
import { GROUP_DISCOUNT, plans, quote, YEARLY_DISCOUNT } from './plans'

describe('pricing plan quote calculator', () => {
  it('includes allowances and charges extra rooms and channels per selected plan', () => {
    const independent = plans[0]!
    expect(quote(independent, { rooms: 20, channels: 1, yearly: false })).toMatchObject({
      base: 149, extraRooms: 0, roomsCost: 0, extraChannels: 0, channelsCost: 0, monthly: 149,
    })
    expect(quote(independent, { rooms: 25, channels: 1, yearly: false })).toMatchObject({
      extraRooms: 5, roomsCost: 10, monthly: 159,
    })

    const boutique = plans[1]!
    const extra = quote(boutique, { rooms: 65, channels: 4, yearly: false })
    expect(extra).toMatchObject({ base: 349, extraRooms: 5, roomsCost: 8, extraChannels: 2, channelsCost: 78, monthly: 435 })
  })

  it('applies yearly discount and rounds each price line before summing', () => {
    const boutique = plans[1]!
    const estimate = quote(boutique, { rooms: 65, channels: 4, yearly: true })
    expect(YEARLY_DISCOUNT).toBe(0.2)
    expect(estimate).toMatchObject({ base: 279, roomsCost: 6, channelsCost: 62, monthly: 347, yearly: 4164 })
    expect(estimate.monthly).toBe(estimate.base + estimate.roomsCost + estimate.channelsCost)
    expect(estimate.yearly).toBe(estimate.monthly * 12)
  })

  it('applies the group discount per property and respects the minimum portfolio size', () => {
    const group = plans[2]!
    const minimum = quote(group, { rooms: 120, channels: 2, yearly: false, properties: 1 })
    expect(minimum.properties).toBe(2)
    expect(minimum.extraRooms).toBe(0)
    expect(minimum.base).toBe(Math.round(349 * (1 - GROUP_DISCOUNT)))

    const estimate = quote(group, { rooms: 200, channels: 4, yearly: false, properties: 3 })
    expect(estimate).toMatchObject({ properties: 3, extraRooms: 20, roomsCost: 30, extraChannels: 2, channelsCost: 234, monthly: 1155 })
    expect(estimate.monthly).toBe(estimate.base * estimate.properties + estimate.roomsCost + estimate.channelsCost)
  })
})
