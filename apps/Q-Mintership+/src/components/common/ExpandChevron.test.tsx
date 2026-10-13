import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@mui/material';
import { HowCounted } from '../../pages/activity/HowCounted';
import { CHEVRON_TURN, ExpandChevron } from './ExpandChevron';

function Toggle() {
  const [open, setOpen] = useState(false);
  return (
    <Button
      aria-expanded={open}
      onClick={() => setOpen((v) => !v)}
      endIcon={<ExpandChevron open={open} />}
    >
      Show
    </Button>
  );
}

describe('ExpandChevron', () => {
  it('turns the same chevron over as the part opens and closes', async () => {
    render(<Toggle />);
    const button = screen.getByRole('button', { name: 'Show' });
    const chevron = button.querySelector('svg') as SVGElement;
    expect(chevron).toHaveAttribute('aria-hidden', 'true');
    expect(chevron).toHaveStyle({ transform: 'none' });
    // The app's timing (index.css → --qmp-motion-enter).
    expect(getComputedStyle(chevron).transition).toBe(CHEVRON_TURN);
    expect(CHEVRON_TURN).toBe('transform var(--qmp-motion-enter) var(--qmp-ease-enter)');
    await userEvent.click(button);
    expect(button.querySelector('svg')).toBe(chevron);
    expect(chevron).toHaveStyle({ transform: 'rotate(180deg)' });
    await userEvent.click(button);
    expect(chevron).toHaveStyle({ transform: 'none' });
  });

  it('turns Activity’s “How this is counted” chevron the same way', () => {
    const { container } = render(<HowCounted data={undefined} />);
    const chevron = container.querySelector('summary svg') as SVGElement;
    expect(getComputedStyle(chevron).transition).toBe(CHEVRON_TURN);
  });
});
