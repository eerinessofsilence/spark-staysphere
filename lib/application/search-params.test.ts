import { describe, expect, it } from 'vitest';
import { withStayQuery } from './search-params';

describe('withStayQuery', () => {
  const stay = 'checkIn=2026-10-01&checkOut=2026-10-04&adults=2&children=0';

  it('returns the link unchanged when there is no stay to carry', () => {
    expect(withStayQuery('/rooms/deluxe-sea')).toBe('/rooms/deluxe-sea');
    expect(withStayQuery('/rooms?view=sea', '')).toBe('/rooms?view=sea');
  });

  it("appends the stay to a link that has no query of its own", () => {
    expect(withStayQuery('/rooms/deluxe-sea', stay)).toBe(`/rooms/deluxe-sea?${stay}`);
  });

  it("keeps the link's own filters and adds the stay after them", () => {
    expect(withStayQuery('/rooms?view=sea', stay)).toBe(`/rooms?view=sea&${stay}`);
  });

  it('lets the stay win over a date the link already names', () => {
    expect(withStayQuery('/rooms?checkIn=2020-01-01&view=sea', 'checkIn=2026-10-01')).toBe(
      '/rooms?checkIn=2026-10-01&view=sea',
    );
  });
});
