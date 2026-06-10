/**
 * E2E Test Configuration
 *
 * Loads configuration from .env.e2e file
 * Provides type-safe access to test configuration variables
 */

import path from 'path';
import os from 'os';

/**
 * E2E Test Configuration Interface
 */
export interface E2EConfig {
  appName: string;
  storeName: string;
  appStorePath: string;
  releaseAppPath: string;
}

/**
 * Load E2E configuration from environment variables
 * Falls back to defaults if .env.e2e is not loaded
 */
export function loadE2EConfig(): E2EConfig {
  const appName = process.env.VITE_APP_NAME || 'audio-to-text';
  const storeName = process.env.VITE_STORE_NAME || 'audio-to-text-test';
  const appStorePathEnv = process.env.VITE_APP_STORE_PATH;
  const releaseAppPath = process.env.VITE_RELEASE_APP_PATH || '../../release/app';

  // Expand ~ in path to home directory
  const expandHome = (p: string): string => {
    return p.replace('~', os.homedir());
  };

  const appStorePath = appStorePathEnv
    ? expandHome(appStorePathEnv)
    : path.join(os.homedir(), 'Library/Application Support', appName);

  return {
    appName,
    storeName,
    appStorePath,
    releaseAppPath,
  };
}

// Load config on module import
export const e2eConfig = loadE2EConfig();
