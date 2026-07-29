import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetMeetingById = vi.fn();
const mockUpdateMeeting = vi.fn((id: string, patch: any) => ({ id, ...patch }));
const mockGetLMStudioPreferences = vi.fn(() => ({
  baseUrl: 'http://localhost:1234',
  model: '',
}));

vi.mock('@/main/store', () => ({
  getMeetingById: mockGetMeetingById,
  updateMeeting: mockUpdateMeeting,
  getLMStudioPreferences: mockGetLMStudioPreferences,
}));

const mockCheckConnection = vi.fn();
const mockSummarizeChunked = vi.fn();
const mockSummarize = vi.fn();

vi.mock('@/main/pipeline/structured-summarizer', () => ({
  checkConnection: mockCheckConnection,
  default: {
    summarizeChunked: mockSummarizeChunked,
    summarize: mockSummarize,
  },
}));

const mockResolveProvider = vi.fn(() => 'lmstudio');
vi.mock('@/main/pipeline/summarizer-provider', () => ({
  SummarizerProviderFactory: { resolve: mockResolveProvider },
}));

const mockLlamaInitialize = vi.fn();
vi.mock('@/main/pipeline/llama-summarizer', () => ({
  default: { initialize: mockLlamaInitialize },
  BUILTIN_MODEL_PATH: '/fake/models/builtin.gguf',
}));

vi.mock('@/main/state/volatile', () => ({
  getMainWindow: vi.fn(() => null),
}));

const mockShowNotification = vi.fn();
vi.mock('@/main/notification-window', () => ({
  showNotification: mockShowNotification,
}));

vi.mock('electron-log', () => ({
  log: vi.fn(),
  default: { info: vi.fn(), error: vi.fn() },
}));

async function importFreshEnrichmentService(): Promise<any> {
  vi.resetModules();
  const mod = await import('../enrichment');
  return mod.default;
}

const baseMeeting = {
  id: 'meeting-1',
  transcript: 'a real transcript',
  type: 'meeting' as const,
};

describe('EnrichmentService.triggerEnrichment() — builtin provider readiness', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetMeetingById.mockReturnValue(baseMeeting);
    mockResolveProvider.mockReturnValue('builtin');
    service = await importFreshEnrichmentService();
  });

  it('attempts llamaSummarizer.initialize() before deciding the builtin provider is not ready', async () => {
    mockLlamaInitialize.mockRejectedValueOnce(
      new Error('model file not found'),
    );

    await service.triggerEnrichment('meeting-1');

    // The bug this test guards against: initialize() must actually be
    // attempted — readiness can't be known from unchanged in-memory state
    // alone, since nothing else ever calls initialize() for this provider.
    expect(mockLlamaInitialize).toHaveBeenCalledWith(
      '/fake/models/builtin.gguf',
    );
    expect(mockUpdateMeeting).toHaveBeenCalledWith('meeting-1', {
      summaryStatus: 'failed',
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Built-in model not ready' }),
    );
    expect(mockSummarizeChunked).not.toHaveBeenCalled();
  });

  it('proceeds to summarization once initialize() succeeds', async () => {
    mockLlamaInitialize.mockResolvedValueOnce(undefined);
    mockSummarizeChunked.mockResolvedValueOnce({
      summary: 'ok',
      decisions: [],
      topics: [],
      actionItems: [],
    });

    await service.triggerEnrichment('meeting-1');

    expect(mockLlamaInitialize).toHaveBeenCalledWith(
      '/fake/models/builtin.gguf',
    );
    expect(mockSummarizeChunked).toHaveBeenCalledWith(baseMeeting.transcript);
    expect(mockUpdateMeeting).toHaveBeenCalledWith(
      'meeting-1',
      expect.objectContaining({ summaryStatus: 'ready' }),
    );
    expect(mockShowNotification).not.toHaveBeenCalled();
  });
});

describe('EnrichmentService.triggerEnrichment() — lmstudio/ollama provider (unchanged path)', () => {
  let service: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockGetMeetingById.mockReturnValue(baseMeeting);
    mockResolveProvider.mockReturnValue('lmstudio');
    service = await importFreshEnrichmentService();
  });

  it('never touches llamaSummarizer.initialize() for the lmstudio provider', async () => {
    mockCheckConnection.mockResolvedValueOnce(true);
    mockSummarizeChunked.mockResolvedValueOnce({
      summary: 'ok',
      decisions: [],
      topics: [],
      actionItems: [],
    });

    await service.triggerEnrichment('meeting-1');

    expect(mockLlamaInitialize).not.toHaveBeenCalled();
    expect(mockCheckConnection).toHaveBeenCalledWith('http://localhost:1234');
  });

  it('shows a connectivity notification and skips summarization when unreachable', async () => {
    mockCheckConnection.mockResolvedValueOnce(false);

    await service.triggerEnrichment('meeting-1');

    expect(mockUpdateMeeting).toHaveBeenCalledWith('meeting-1', {
      summaryStatus: 'failed',
    });
    expect(mockShowNotification).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'LM Studio unreachable' }),
    );
    expect(mockSummarizeChunked).not.toHaveBeenCalled();
  });
});
