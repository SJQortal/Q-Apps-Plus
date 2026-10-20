import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FailedReads, Waiting } from './parts';

describe('Compare’s live regions', () => {
  it('“Reading …” keeps its live words fixed while the details change as reads land', () => {
    const view = render(
      <Waiting announce="Reading what was recorded between them…">
        Reading what was recorded between A–B, A–C: payments both ways, reward shares…
      </Waiting>
    );
    const live = screen.getAllByRole('status');
    expect(live.map((s) => s.textContent)).toEqual(['Reading what was recorded between them…']);
    view.rerender(
      <Waiting announce="Reading what was recorded between them…">
        Reading what was recorded between A–C: reward shares…
      </Waiting>
    );
    // The same node, the same words: nothing new to announce.
    expect(screen.getAllByRole('status')).toEqual(live);
    expect(live[0]).toHaveTextContent(/^Reading what was recorded between them…$/);
    expect(screen.getByText(/between A–C: reward shares/)).not.toHaveAttribute('role');
  });

  it('the failed-reads line keeps its live words fixed while the list grows', () => {
    const line = (what: string[]) => (
      <FailedReads
        what={what}
        onRetry={() => undefined}
        retryLabel="Retry In common"
        announce="In common: some reads failed."
      />
    );
    const view = render(line(['A’s groups']));
    const live = screen.getAllByRole('status');
    expect(live.map((s) => s.textContent)).toEqual(['In common: some reads failed.']);
    view.rerender(line(['A’s groups', 'B’s groups']));
    expect(screen.getAllByRole('status')).toEqual(live);
    expect(live[0]).toHaveTextContent(/^In common: some reads failed\.$/);
    const list = screen.getByText('Couldn’t read A’s groups and B’s groups.');
    expect(list).not.toHaveAttribute('role');
    expect(screen.getByRole('button', { name: 'Retry In common' })).toBeInTheDocument();
  });
});
