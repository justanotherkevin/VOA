import * as devFixtures from './fixtures-dev';
import * as prodFixtures from './fixtures-prod';

/**
 * Playwright Fixtures for E2E Tests
 *
 * Auto-selects between development and production fixtures based on environment:
 * - Development (default): NODE_ENV=development, uses Vite dev server
 * - Production (CI): NODE_ENV=production, uses dist/ artifacts
 */
const fixtures = process.env.NODE_ENV === 'production' ? prodFixtures : devFixtures;

export const test = fixtures.test;
export const expect = fixtures.expect;
