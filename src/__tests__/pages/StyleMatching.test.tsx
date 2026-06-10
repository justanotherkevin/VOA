import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StyleMatching from '@/renderer/pages/StyleMatching';
import { MemoryRouter } from 'react-router-dom';

describe('Style Matching Page', () => {
  it('should render without crashing', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    expect(screen.getByText('Style Matching')).toBeDefined();
  });

  it('should display style matching title', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    const title = screen.getByText('Style Matching');
    expect(title).toBeTruthy();
  });

  it('should display description about writing styles', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    const description = screen.getByText(/Willow learns/i);
    expect(description).toBeDefined();
  });

  it('should display enable style matching toggle', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    const toggleLabel = screen.getByText('Enable Style Matching');
    expect(toggleLabel).toBeDefined();
  });

  it('should display message type tabs', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    expect(screen.getByText('Casual Messages')).toBeDefined();
    expect(screen.getByText('Work Messages')).toBeDefined();
    expect(screen.getByText('Email')).toBeDefined();
  });

  it('should display style options', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    expect(screen.getByText('Formal')).toBeDefined();
    expect(screen.getByText('Casual')).toBeDefined();
    expect(screen.getByText('Extremely Casual')).toBeDefined();
  });

  it('should display style context examples', () => {
    render(
      <MemoryRouter>
        <StyleMatching />
      </MemoryRouter>
    );
    const contextText = screen.getByText(/professional/i);
    expect(contextText).toBeDefined();
  });
});
