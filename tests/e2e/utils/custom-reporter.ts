import {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

/**
 * A custom Playwright reporter that provides a clean, focused output.
 * It removes file paths and line numbers, showing only the test titles and status.
 */
class CleanReporter implements Reporter {
  onStdOut(chunk: string) {
    process.stdout.write(chunk);
  }

  onStdErr(chunk: string) {
    process.stderr.write(chunk);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const symbols: Record<string, string> = {
      passed: '✓',
      failed: '✘',
      timedOut: '🕒',
      skipped: '➖',
    };

    const symbol = symbols[result.status] || '?';
    const duration =
      result.duration > 1000
        ? `${(result.duration / 1000).toFixed(1)}s`
        : `${result.duration}ms`;

    const pathItems = test.titlePath();
    const title = pathItems
      .filter(
        (item) => item && !item.endsWith('.spec.ts') && !item.endsWith('.ts'),
      )
      .join(' › ');

    if (result.status === 'passed') {
      console.log(`  ${symbol}  ${title} (${duration})`);
    } else if (result.status === 'failed' || result.status === 'timedOut') {
      console.log(`  ${symbol}  ${title} (${duration})`);
      if (result.error) {
        // Indent error message for clarity
        const errorMessage = result.error.message || 'Unknown error';
        console.log(
          errorMessage
            .split('\n')
            .map((line) => `     ${line}`)
            .join('\n'),
        );
      }
    } else if (result.status === 'skipped') {
      // Optionally log skipped tests
    }
  }

  onEnd(result: FullResult) {
    console.log(''); // Add newline before summary
    if (result.status === 'passed') {
      console.log('  ✨ All E2E tests passed!');
    } else {
      console.log(
        `  🏁 Tests finished with status: ${result.status.toUpperCase()}`,
      );
    }
  }
}

export default CleanReporter;
