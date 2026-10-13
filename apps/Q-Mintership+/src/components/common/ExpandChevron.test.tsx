import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@mui/material';
import { ExpandChevron } from './ExpandChevron';

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
    expect(getComputedStyle(chevron).transition).toMatch(/^transform 200ms/);
    await userEvent.click(button);
    expect(button.querySelector('svg')).toBe(chevron);
    expect(chevron).toHaveStyle({ transform: 'rotate(180deg)' });
    await userEvent.click(button);
    expect(chevron).toHaveStyle({ transform: 'none' });
  });
});
