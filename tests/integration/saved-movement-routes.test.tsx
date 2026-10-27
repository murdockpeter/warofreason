import { beforeEach, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { seedFontenoyOperational } from '../../src/domain/fontenoy-operational';
import { WaterlooDesk } from '../../src/renderer/WaterlooDesk';
import { useCampaigns } from '../../src/renderer/campaign-store';
import { useOperationalSession } from '../../src/renderer/operational-session';
import { operationalNow } from '../fixtures/simultaneous-aftermath';

function seed() {
  const c = seedFontenoyOperational(
    'Saved route display',
    () => crypto.randomUUID(),
    operationalNow,
  );
  for (const [index, side] of [
    [0, 'french'],
    [2, 'allied'],
  ] as const) {
    const force = c.corps[index]!,
      start = force.hexId!;
    const next = side === 'french' ? '4,2' : '9,1';
    c.submissions.find((s) => s.side === side)!.orders = [
      {
        corpsId: force.id,
        priority: 0,
        segments: [
          {
            path: [start, next],
            roadOnly: false,
            startAt: 390,
            hqId: c.hqs.find((h) => h.army === force.army)!.id,
          },
          {
            path: [next, side === 'french' ? '5,2' : '10,1'],
            roadOnly: false,
            startAt: 450,
            hqId: c.hqs.find((h) => h.army === force.army)!.id,
          },
        ],
      },
    ];
  }
  return c;
}
beforeEach(() => {
  useCampaigns.setState({
    waterlooDraft: null,
    pending: false,
    error: null,
    message: null,
  });
  useOperationalSession.setState({ view: 'umpire' });
});

it('shows saved segments without a draft and retains them alongside the next unsaved segment', () => {
  const c = seed(),
    before = structuredClone(c);
  useOperationalSession.setState({ view: 'french' });
  const ui = render(<WaterlooDesk campaign={c} />);
  const saved = screen.getByRole('img', {
    name: `Saved movement order for ${c.corps[0]!.name} · planning`,
  });
  expect(saved.querySelectorAll('.saved-order-segment')).toHaveLength(2);
  expect(saved.querySelectorAll('[marker-end]')).toHaveLength(2);
  expect(saved.querySelector('.saved-order-line')).toHaveAttribute(
    'points',
    '253,130 305,130',
  );
  ui.unmount();
  useCampaigns.setState({
    waterlooDraft: {
      kind: 'route',
      corpsId: c.corps[0]!.id,
      path: ['5,2', '6,2'],
      roadOnly: false,
      startAt: 510,
      hqId: c.hqs[0]!.id,
    },
  });
  render(<WaterlooDesk campaign={c} />);
  expect(
    screen.getByRole('img', { name: /Saved movement order/ }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Unsaved movement route' }),
  ).toHaveAttribute('points', '357,130 409,130');
  expect(c).toEqual(before);
});

it('keeps routes through locks, shows both sides to the umpire and withholds opposing route/draft data in faction views', () => {
  const c = seed();
  c.submissions.forEach((s) => {
    s.locked = true;
  });
  c.phase = 'locked';
  const ui = render(<WaterlooDesk campaign={c} />);
  expect(
    screen.getAllByRole('img', { name: /Saved movement order/ }),
  ).toHaveLength(2);
  expect(
    screen
      .getAllByRole('img', { name: /Saved movement order/ })
      .every((e) => e.getAttribute('aria-label')!.endsWith('locked')),
  ).toBe(true);
  ui.unmount();
  useOperationalSession.setState({ view: 'allied' });
  useCampaigns.setState({
    waterlooDraft: {
      kind: 'route',
      corpsId: c.corps[0]!.id,
      path: ['5,2', '6,2'],
      roadOnly: false,
      startAt: 510,
      hqId: c.hqs[0]!.id,
    },
  });
  const faction = render(<WaterlooDesk campaign={c} />);
  expect(
    screen.getAllByRole('img', { name: /Saved movement order/ }),
  ).toHaveLength(1);
  expect(
    screen.queryByRole('img', {
      name: new RegExp(`Saved movement order for ${c.corps[0]!.name}`),
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('img', { name: 'Unsaved movement route' }),
  ).not.toBeInTheDocument();
  expect(faction.container.querySelectorAll('.hex-route')).toHaveLength(0);
});

it('removes the overlay when orders are cleared or movement resolution starts', () => {
  const c = seed(),
    ui = render(<WaterlooDesk campaign={c} />);
  ui.rerender(<WaterlooDesk campaign={{ ...c, phase: 'checkpoint' }} />);
  expect(
    screen.queryAllByRole('img', { name: /Saved movement order/ }),
  ).toHaveLength(0);
  c.submissions.forEach((s) => {
    s.orders = [];
  });
  ui.rerender(<WaterlooDesk campaign={c} />);
  expect(
    screen.queryAllByRole('img', { name: /Saved movement order/ }),
  ).toHaveLength(0);
});
