import { expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HistoricalOob } from '../../src/renderer/HistoricalOob';

it('searches the offline reference and resets an incompatible contingent when the faction view changes', async () => {
  const user = userEvent.setup();
  const ui = render(<HistoricalOob view="umpire" />);
  await user.selectOptions(
    screen.getByLabelText('Historical contingent'),
    'british',
  );
  await user.type(
    screen.getByLabelText('Search historical roster'),
    '25th Foot',
  );
  await user.click(
    screen.getByText(/Rothe's\/Sempill's/, { selector: 'summary' }),
  );
  expect(screen.getByText(/dates unverified/)).toHaveTextContent('25th Foot');
  ui.rerender(<HistoricalOob view="french" />);
  expect(screen.queryByText(/Rothe's\/Sempill's/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Historical contingent')).toHaveValue('');
  await user.clear(screen.getByLabelText('Search historical roster'));
  expect(
    screen.getByText(/Gardes Françaises/, { selector: 'summary' }),
  ).toBeInTheDocument();
  expect(screen.queryByText(/Garde te Voet/)).not.toBeInTheDocument();
  expect(screen.getByText('Approach to Fontenoy')).toBeInTheDocument();
});
