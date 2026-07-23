import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TranscriptTagRenderer } from '@/renderer/components/ui/TranscriptTagRenderer';

describe('TranscriptTagRenderer', () => {
  it('renders one Message row per speaker turn in gutter style', () => {
    const text = '[Meeting] Hello there. [Mic] Hi back. [Meeting] More words.';
    const { container } = render(
      <TranscriptTagRenderer text={text} style="gutter" />,
    );

    expect(container.querySelectorAll('[data-slot="message"]')).toHaveLength(3);
    expect(container.textContent).toContain('Hello there.');
    expect(container.textContent).toContain('Hi back.');
  });

  it('aligns mic turns to the end and meeting turns to the start', () => {
    const text = '[Meeting] From the room. [Mic] From me.';
    const { container } = render(
      <TranscriptTagRenderer text={text} style="gutter" />,
    );

    const messages = container.querySelectorAll('[data-slot="message"]');
    expect(messages[0]).toHaveAttribute('data-align', 'start');
    expect(messages[1]).toHaveAttribute('data-align', 'end');
  });

  it('gives each speaker avatar an accessible label', () => {
    const text = '[Meeting] From the room. [Mic] From me.';
    const { getByLabelText } = render(
      <TranscriptTagRenderer text={text} style="gutter" />,
    );

    expect(getByLabelText('System audio')).toBeInTheDocument();
    expect(getByLabelText('Mic audio')).toBeInTheDocument();
  });

  it('renders inline pill tags in pill style', () => {
    const text = '[Meeting] Hello there.';
    const { container } = render(
      <TranscriptTagRenderer text={text} style="pill" />,
    );

    expect(container.querySelector('[data-slot="message"]')).toBeNull();
    expect(container.textContent).toContain('Hello there.');
  });
});
