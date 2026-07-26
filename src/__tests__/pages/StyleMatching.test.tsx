import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StyleMatching from '@/renderer/pages/StyleMatching';
import { MemoryRouter } from 'react-router-dom';

describe('Style Matching Page', () => {
  it('should render without crashing', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Style Matching' }),
    ).toBeDefined();
  });

  it('should display style matching title', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>,
    );
    const title = screen.getByRole('heading', {
      level: 1,
      name: 'Style Matching',
    });
    expect(title).toBeTruthy();
  });

  it('should display enable style matching toggle', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>,
    );
    const toggleLabel = screen.getByRole('heading', {
      level: 2,
      name: 'Enable Style Matching',
    });
    expect(toggleLabel).toBeDefined();
  });

  it('should display message type tabs', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'Casual Messages' }),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Work Messages' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Email' })).toBeDefined();
  });

  it('should display style options', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>,
    );
    // Style names render as <h3> headings nested inside their selection
    // buttons, not as the button's own accessible name (which also includes
    // the description/example text) — query by heading, not button.
    expect(
      screen.getByRole('heading', { level: 3, name: 'Formal' }),
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Casual' }),
    ).toBeDefined();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Extremely Casual' }),
    ).toBeDefined();
  });

  it('should display style context examples', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>,
    );
    const contextText = screen.getByText(/professional/i);
    expect(contextText).toBeDefined();
  });
});
