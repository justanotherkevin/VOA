import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dictionary from '@/renderer/pages/Dictionary';
import { MemoryRouter } from 'react-router-dom';

describe('Dictionary Page', () => {
  it('should render without crashing', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Dictionary' }),
    ).toBeDefined();
  });

  it('should display dictionary title', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>,
    );
    const title = screen.getByRole('heading', { level: 1, name: 'Dictionary' });
    expect(title).toBeTruthy();
  });

  it('should display add new word button', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>,
    );
    const button = screen.getByRole('button', { name: /add new word/i });
    expect(button).toBeDefined();
  });

  it('should display dictionary entries section', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>,
    );
    const entriesHeading = screen.getByRole('heading', {
      level: 2,
      name: /dictionary entries/i,
    });
    expect(entriesHeading).toBeDefined();
  });

  it('should show empty state message', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>,
    );
    const emptyState = screen.getByTestId('dictionary-empty-state');
    expect(emptyState).toBeDefined();
  });
});
