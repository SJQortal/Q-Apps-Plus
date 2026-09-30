import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders } from '../../../test/renderWithProviders';
import NavBar from './Navbar';

const baseProps = {
  userAvatar: '',
  accountNames: [],
  setActiveName: () => {},
};

describe('NavBar', () => {
  it('offers Sign in when signed out, and asks Hub again when tapped', () => {
    const authenticate = vi.fn();
    renderWithProviders(<NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={authenticate} canSignIn />);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(authenticate).toHaveBeenCalledTimes(1);
  });

  it('shows no Sign in while a request is out or once signed in', () => {
    const { unmount } = renderWithProviders(
      <NavBar {...baseProps} isAuthenticated={false} userName="" authenticate={() => {}} canSignIn={false} />
    );
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    unmount();

    renderWithProviders(
      <NavBar
        {...baseProps}
        isAuthenticated
        userName="alice"
        accountNames={[{ name: 'alice' }]}
        authenticate={() => {}}
        canSignIn={false}
      />
    );
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu for alice' })).toBeInTheDocument();
  });
});
