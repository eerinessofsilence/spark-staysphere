export type PlanSlug = 'independent' | 'boutique' | 'group'
export type Plan = { slug: PlanSlug; name: string; tagline: string; featured?: boolean; features: string[]; rooms: { max: number } }

/** Property-size presets for quote requests; CMS pricing is agreed separately. */
export const plans: Plan[] = [
  { slug: 'independent', name: 'Independent', tagline: 'A showcase and content workspace for one property.', rooms: { max: 40 }, features: ['Hotel and room content', 'Room galleries and panoramas', 'Interactive building orbit and zones', 'Service catalog', 'External booking link'] },
  { slug: 'boutique', name: 'Boutique', tagline: 'Discuss a larger room catalog and media setup.', featured: true, rooms: { max: 200 }, features: ['Guest + CMS', 'Individual rooms and floor navigation', 'Photo and panorama uploads', 'Reference prices and hotel policies', 'Administrator and editor access'] },
  { slug: 'group', name: 'Group', tagline: 'Discuss a separate showcase and CMS for each property.', rooms: { max: 1000 }, features: ['Guest + CMS per property', 'Independent content and media storage', 'Property-specific booking links', 'Deployment and onboarding scope agreed separately'] },
]
export const planBySlug = (slug: string | null | undefined): Plan => plans.find((plan) => plan.slug === slug) ?? plans[0]!
