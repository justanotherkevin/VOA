/**
 * Test Data Fixtures for E2E Tests
 *
 * Provides realistic sample transcripts for testing.
 * These fixtures are used to initialize the test electron-store
 * with known data for predictable test runs.
 */

import { StoredTranscript } from '@/main/store';

/**
 * Generate default test transcripts
 * Returns 3 sample transcripts with realistic data
 */
export function getDefaultTestTranscripts(): StoredTranscript[] {
	const now = Date.now();
	return [
		{
			id: '550e8400-e29b-41d4-a716-446655440001',
			date: now - 2 * 60 * 60 * 1000, // 2 hours ago
			text: 'The quick brown fox jumps over the lazy dog. This is a test transcription.',
			chunks: [
				{ text: 'The quick brown fox', timestamp: [0, 1.2] },
				{ text: 'jumps over the lazy dog', timestamp: [1.2, 2.5] },
				{ text: 'This is a test transcription', timestamp: [2.5, 4.1] },
			],
		},
		{
			id: '550e8400-e29b-41d4-a716-446655440002',
			date: now - 1 * 60 * 60 * 1000, // 1 hour ago
			text: 'Software testing is crucial for quality assurance and reliability.',
			chunks: [
				{ text: 'Software testing', timestamp: [0, 0.8] },
				{ text: 'is crucial for quality assurance', timestamp: [0.8, 2.1] },
				{ text: 'and reliability', timestamp: [2.1, 2.9] },
			],
		},
		{
			id: '550e8400-e29b-41d4-a716-446655440003',
			date: now - 30 * 60 * 1000, // 30 minutes ago
			text: 'End to end testing validates the complete application workflow.',
			chunks: [
				{ text: 'End to end testing', timestamp: [0, 1.0] },
				{ text: 'validates the complete application', timestamp: [1.0, 2.2] },
				{ text: 'workflow', timestamp: [2.2, 2.7] },
			],
		},
	];
}
