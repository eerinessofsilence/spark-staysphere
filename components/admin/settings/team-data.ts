export const teamRoles = [
  'Owner',
  'General manager',
  'Revenue manager',
  'Front desk',
  'Content editor',
] as const;

export type TeamRole = (typeof teamRoles)[number];

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  status: 'active' | 'invited';
  lastActive: string;
  /** Added from the invite dialog in this browser; never sent anywhere. */
  demoInvite?: boolean;
}

export const demoMembers: TeamMember[] = [
  {
    id: 'elena',
    name: 'Elena Markou',
    email: 'elena.markou@asteriacove.example',
    role: 'Owner',
    status: 'active',
    lastActive: 'Today',
  },
  {
    id: 'andreas',
    name: 'Andreas Christou',
    email: 'andreas.christou@asteriacove.example',
    role: 'General manager',
    status: 'active',
    lastActive: 'Yesterday',
  },
  {
    id: 'sofia',
    name: 'Sofia Nikolaou',
    email: 'sofia.nikolaou@asteriacove.example',
    role: 'Revenue manager',
    status: 'active',
    lastActive: '2 days ago',
  },
  {
    id: 'marios',
    name: 'Marios Georgiou',
    email: 'front.desk@asteriacove.example',
    role: 'Front desk',
    status: 'active',
    lastActive: '3 hours ago',
  },
  {
    id: 'katerina',
    name: 'Katerina Ioannou',
    email: 'katerina.ioannou@asteriacove.example',
    role: 'Content editor',
    status: 'invited',
    lastActive: 'Not signed in yet',
  },
];

export const permissions: { label: string; allowed: TeamRole[] }[] = [
  {
    label: 'View bookings',
    allowed: ['Owner', 'General manager', 'Revenue manager', 'Front desk'],
  },
  { label: 'Cancel bookings', allowed: ['Owner', 'General manager', 'Front desk'] },
  { label: 'Edit rates & availability', allowed: ['Owner', 'General manager', 'Revenue manager'] },
  { label: 'Edit site content', allowed: ['Owner', 'General manager', 'Content editor'] },
  { label: 'Manage media', allowed: ['Owner', 'General manager', 'Content editor'] },
  { label: 'Brand & domain', allowed: ['Owner', 'General manager'] },
  { label: 'Team & roles', allowed: ['Owner'] },
  { label: 'Integrations', allowed: ['Owner', 'General manager'] },
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/[\s.@_-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
