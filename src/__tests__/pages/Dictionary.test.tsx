import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Dictionary from '@/renderer/pages/Dictionary';
import { MemoryRouter } from 'react-router-dom';

describe('Dictionary Page', () => {
  it('should render without crashing', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    );
    expect(screen.getByText('Dictionary')).toBeDefined();
  });

  it('should display dictionary title', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    );
    const title = screen.getByText('Dictionary');
    expect(title).toBeTruthy();
  });

  it('should display description about custom words', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    );
    const description = screen.getByText(/manage your custom/i);
    expect(description).toBeDefined();
  });

  it('should display add new word button', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    );
    const button = screen.getByText(/add new word/i);
    expect(button).toBeDefined();
  });

  it('should display dictionary entries section', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    );
    const entriesHeading = screen.getByText(/dictionary entries/i);
    expect(entriesHeading).toBeDefined();
  });

  it('should show empty state message', () => {
    render(
      <MemoryRouter>
        <Dictionary />
      </MemoryRouter>
    );
    const emptyState = screen.getByText(/no entries/i);
    expect(emptyState).toBeDefined();
  });
});
