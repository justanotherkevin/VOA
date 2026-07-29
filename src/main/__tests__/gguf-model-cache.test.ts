/// <reference types="vitest/globals" />

import { vi } from 'vitest';
import path from 'path';

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(),
    renameSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));

import fs from 'fs';
import {
  isModelDownloaded,
  getModelPath,
  downloadModel,
  deleteModel,
} from '../gguf-model-cache';
import { BUILTIN_MODEL_PATH } from '../pipeline/llama-summarizer';

const mockFs = fs as unknown as {
  existsSync: ReturnType<typeof vi.fn>;
  mkdirSync: ReturnType<typeof vi.fn>;
  createWriteStream: ReturnType<typeof vi.fn>;
  renameSync: ReturnType<typeof vi.fn>;
  rmSync: ReturnType<typeof vi.fn>;
};

describe('gguf-model-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getModelPath returns BUILTIN_MODEL_PATH', () => {
    expect(getModelPath()).toBe(BUILTIN_MODEL_PATH);
  });

  it('isModelDownloaded returns false when the model file does not exist', () => {
    mockFs.existsSync.mockReturnValue(false);
    expect(isModelDownloaded()).toBe(false);
    expect(mockFs.existsSync).toHaveBeenCalledWith(BUILTIN_MODEL_PATH);
  });

  it('isModelDownloaded returns true when the model file exists', () => {
    mockFs.existsSync.mockReturnValue(true);
    expect(isModelDownloaded()).toBe(true);
  });

  it('deleteModel refuses to delete a path outside the model directory', async () => {
    const resolveSpy = vi
      .spyOn(path, 'resolve')
      .mockReturnValueOnce('/some/other/place/evil.gguf') // resolvedPath
      .mockReturnValueOnce('/expected/model/dir'); // resolvedDir

    const result = await deleteModel();

    expect(result).toBe(false);
    expect(mockFs.rmSync).not.toHaveBeenCalled();

    resolveSpy.mockRestore();
  });

  it('deleteModel returns false when the file is not present', async () => {
    mockFs.existsSync.mockReturnValue(false);
    const result = await deleteModel();
    expect(result).toBe(false);
    expect(mockFs.rmSync).not.toHaveBeenCalled();
  });

  it('deleteModel removes the file when it exists inside the model directory', async () => {
    mockFs.existsSync.mockReturnValue(true);
    const result = await deleteModel();
    expect(result).toBe(true);
    expect(mockFs.rmSync).toHaveBeenCalledWith(
      path.resolve(BUILTIN_MODEL_PATH),
      {
        force: true,
      },
    );
  });

  it('downloadModel streams the response and invokes onProgress per chunk', async () => {
    const written: Buffer[] = [];
    const writeStream = {
      write: (chunk: Buffer, cb: (err?: Error) => void) => {
        written.push(chunk);
        cb();
      },
      end: (cb: () => void) => cb(),
    };
    mockFs.createWriteStream.mockReturnValue(writeStream);

    const chunk1 = new Uint8Array(10);
    const chunk2 = new Uint8Array(20);
    let call = 0;
    const reader = {
      read: vi.fn(async () => {
        call += 1;
        if (call === 1) return { done: false, value: chunk1 };
        if (call === 2) return { done: false, value: chunk2 };
        return { done: true, value: undefined };
      }),
    };

    const fakeResponse = {
      ok: true,
      body: { getReader: () => reader },
      headers: { get: () => '30' },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse as unknown as Response),
    );

    const onProgress = vi.fn();
    await downloadModel(onProgress);

    expect(onProgress).toHaveBeenCalledWith(10, 30);
    expect(onProgress).toHaveBeenCalledWith(30, 30);
    expect(mockFs.renameSync).toHaveBeenCalledWith(
      `${BUILTIN_MODEL_PATH}.part`,
      BUILTIN_MODEL_PATH,
    );
  });

  it('downloadModel deletes the partial file and throws on size mismatch', async () => {
    const writeStream = {
      write: (_chunk: Buffer, cb: (err?: Error) => void) => cb(),
      end: (cb: () => void) => cb(),
    };
    mockFs.createWriteStream.mockReturnValue(writeStream);

    const chunk = new Uint8Array(5);
    let call = 0;
    const reader = {
      read: vi.fn(async () => {
        call += 1;
        if (call === 1) return { done: false, value: chunk };
        return { done: true, value: undefined };
      }),
    };

    const fakeResponse = {
      ok: true,
      body: { getReader: () => reader },
      headers: { get: () => '50000000' },
    };

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(fakeResponse as unknown as Response),
    );

    await expect(downloadModel()).rejects.toThrow(/size mismatch/);
    expect(mockFs.rmSync).toHaveBeenCalledWith(`${BUILTIN_MODEL_PATH}.part`, {
      force: true,
    });
  });

  it('downloadModel de-duplicates concurrent calls into a single in-flight download', async () => {
    const writeStream = {
      write: (_chunk: Buffer, cb: (err?: Error) => void) => cb(),
      end: (cb: () => void) => cb(),
    };
    mockFs.createWriteStream.mockReturnValue(writeStream);

    const chunk = new Uint8Array(30);
    let call = 0;
    const reader = {
      read: vi.fn(async () => {
        call += 1;
        if (call === 1) return { done: false, value: chunk };
        return { done: true, value: undefined };
      }),
    };

    const fakeResponse = {
      ok: true,
      body: { getReader: () => reader },
      headers: { get: () => '30' },
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse as unknown as Response);
    vi.stubGlobal('fetch', fetchMock);

    const firstCall = downloadModel();
    const secondCall = downloadModel();

    await expect(firstCall).resolves.toBeUndefined();
    await expect(secondCall).resolves.toBeUndefined();
    expect(firstCall).toBe(secondCall);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
