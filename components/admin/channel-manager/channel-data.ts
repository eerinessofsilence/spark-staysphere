/**
 * The OTA channels the demo channel manager can connect. Display data only:
 * no channel is actually reached, and connecting one is local page state.
 * Marks are a monogram on the channel's own hue, not the channel's logo.
 */
export interface Channel {
  id: string;
  name: string;
  monogram: string;
  /** Tile background and ink, as literal colours — the channel's hue, not a product token. */
  hue: { bg: string; ink: string };
  kind: string;
  commission: number;
  markets: string;
}

export const channels: Channel[] = [
  { id: 'booking', name: 'Booking.com', monogram: 'B.', hue: { bg: '#e6ecf7', ink: '#1a3a7a' }, kind: 'OTA', commission: 15, markets: 'Worldwide' },
  { id: 'airbnb', name: 'Airbnb', monogram: 'A', hue: { bg: '#fde8ea', ink: '#b3263a' }, kind: 'Home-sharing', commission: 15, markets: 'Worldwide' },
  { id: 'expedia', name: 'Expedia', monogram: 'E', hue: { bg: '#fdf3d9', ink: '#7a5a06' }, kind: 'OTA', commission: 18, markets: 'Worldwide' },
  { id: 'hrs', name: 'HRS', monogram: 'H', hue: { bg: '#f9e3e3', ink: '#a12a2a' }, kind: 'Business travel', commission: 12, markets: 'Europe' },
  { id: 'agoda', name: 'Agoda', monogram: 'Ag', hue: { bg: '#e5f1ea', ink: '#23643f' }, kind: 'OTA', commission: 17, markets: 'Asia-Pacific' },
  { id: 'trip', name: 'Trip.com', monogram: 'T', hue: { bg: '#e3eefc', ink: '#1757b8' }, kind: 'OTA', commission: 15, markets: 'Asia, Europe' },
  { id: 'hotels', name: 'Hotels.com', monogram: 'H.', hue: { bg: '#fbe6e6', ink: '#9b2222' }, kind: 'OTA', commission: 18, markets: 'Worldwide' },
  { id: 'google', name: 'Google Hotel Ads', monogram: 'G', hue: { bg: '#e8f0fb', ink: '#2456a6' }, kind: 'Metasearch', commission: 0, markets: 'Worldwide' },
  { id: 'tripadvisor', name: 'Tripadvisor', monogram: 'Ta', hue: { bg: '#def3ea', ink: '#1d6b4a' }, kind: 'Metasearch', commission: 0, markets: 'Worldwide' },
  { id: 'vrbo', name: 'Vrbo', monogram: 'V', hue: { bg: '#e4ecf6', ink: '#27477a' }, kind: 'Home-sharing', commission: 8, markets: 'US, Europe' },
  { id: 'hostelworld', name: 'Hostelworld', monogram: 'Hw', hue: { bg: '#fce9dc', ink: '#9a4a14' }, kind: 'OTA', commission: 15, markets: 'Worldwide' },
  { id: 'despegar', name: 'Despegar', monogram: 'D', hue: { bg: '#ece5f7', ink: '#553388' }, kind: 'OTA', commission: 16, markets: 'Latin America' },
];

export const initiallyConnected = ['booking', 'airbnb', 'expedia', 'hrs'];

/** A channel type a hotel team would pick for one not on the known list. */
export const CHANNEL_KINDS = [
  'OTA',
  'Metasearch',
  'Home-sharing',
  'Wholesaler',
  'Corporate / business travel',
  'GDS',
  'Other',
] as const;

/** How a custom channel gets rates, availability and bookings — same three tiers every channel manager offers one of. */
export const CONNECTION_METHODS = [
  { value: 'two_way', label: 'Two-way API', hint: 'Rates and availability sync both ways; bookings pull in automatically.' },
  { value: 'one_way', label: 'One-way (rates and availability only)', hint: "Pushes out what you set here; the channel's own bookings don't pull back in." },
  { value: 'feed', label: 'iCal / CSV feed', hint: 'No live API — availability exports on a schedule, and bookings arrive by email.' },
] as const;
export type ConnectionMethod = (typeof CONNECTION_METHODS)[number]['value'];

/** A rotating set of neutral hues for a custom channel, which has no real brand colour to draw from. */
export const CUSTOM_HUES = [
  { bg: '#e9e5dd', ink: '#5f5e58' },
  { bg: '#efe7d3', ink: '#7f6a35' },
  { bg: '#e2e9de', ink: '#4c6a4e' },
  { bg: '#f1e2e0', ink: '#93565a' },
  { bg: '#e3eefc', ink: '#1757b8' },
];

export const channexPropertyId = '621c9410-8281-4b7e-8733-713362084074';
