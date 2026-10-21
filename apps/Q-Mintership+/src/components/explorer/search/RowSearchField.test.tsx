/** The small search field: answers after a pause, Enter at once, Escape and Clear empty it. */
import { describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { RowSearchField, SEARCH_PAUSE_MS } from './RowSearchField';

function show(value = '') {
  const onChange = vi.fn();
  const result = render(
    <RowSearchField value={value} onChange={onChange} placeholder="Search these" />
  );
  return { ...result, onChange, field: screen.getByRole('searchbox', { name: 'Search these' }) };
}

describe('RowSearchField', () => {
  it('answers once typing pauses, and at once on Enter', () => {
    vi.useFakeTimers();
    try {
      const { field, onChange } = show();
      fireEvent.change(field, { target: { value: 'cr' } });
      fireEvent.change(field, { target: { value: 'crow' } });
      expect(onChange).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(SEARCH_PAUSE_MS));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith('crow');
      fireEvent.change(field, { target: { value: 'crowe' } });
      fireEvent.keyDown(field, { key: 'Enter' });
      expect(onChange).toHaveBeenLastCalledWith('crowe');
    } finally {
      vi.useRealTimers();
    }
  });

  it('empties with Escape or Clear, and follows a value from the link', () => {
    const { field, onChange, rerender } = show('crow');
    expect(field).toHaveValue('crow');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    rerender(<RowSearchField value="bob" onChange={onChange} placeholder="Search these" />);
    expect(field).toHaveValue('bob');
    fireEvent.click(screen.getByRole('button', { name: 'Clear the search' }));
    expect(field).toHaveValue('');
    expect(onChange).toHaveBeenLastCalledWith('');
    expect(screen.queryByRole('button', { name: 'Clear the search' })).toBeNull();
  });
});
