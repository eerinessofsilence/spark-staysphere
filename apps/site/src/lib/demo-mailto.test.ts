import { describe, expect, it } from 'vitest'
import { buildDemoRequestMailto } from './demo-mailto'

describe('demo request mailto builder', () => {
  it('encodes the title, newlines and all contact fields without opening a mail app', () => {
    const href = buildDemoRequestMailto('Final price & payment', {
      name: 'Ada Lovelace', property: 'Harbor & Cove', email: 'ada+stay@example.test',
      phone: '+44 20 1234 5678', message: 'Rooms: 40\nChannels: 3',
    })
    const url = new URL(href)
    expect(url.protocol).toBe('mailto:')
    expect(url.pathname).toBe('stay@asteriacove.example')
    expect(url.searchParams.get('subject')).toBe('Final price & payment')
    expect(url.searchParams.get('body')).toBe('Rooms: 40\nChannels: 3\n\nName: Ada Lovelace\nProperty / portfolio: Harbor & Cove\nEmail: ada+stay@example.test\nPhone: +44 20 1234 5678')
  })

  it('omits an empty optional property and trims the seeded message', () => {
    const url = new URL(buildDemoRequestMailto('Request a demo', {
      name: 'Ada', property: '  ', email: 'ada@example.test', phone: '+1 555', message: '  Hello  ',
    }))
    expect(url.searchParams.get('body')).toBe('Hello\n\nName: Ada\nEmail: ada@example.test\nPhone: +1 555')
  })
})
