import { CONTACT_EMAIL } from './links'

export function buildDemoRequestMailto(title: string, fields: { name: string; property: string; email: string; phone: string; message: string }) {
  const lines = [
    fields.message.trim(),
    fields.message.trim() ? '' : null,
    `Name: ${fields.name}`,
    fields.property.trim() ? `Property / portfolio: ${fields.property}` : null,
    `Email: ${fields.email}`,
    `Phone: ${fields.phone}`,
  ].filter((line): line is string => line !== null)
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(lines.join('\n'))}`
}
