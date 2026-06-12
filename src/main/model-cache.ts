import fs from 'fs';
import os from 'os';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rm = promisify(fs.rm);

export interface CachedModel {
  name: string;
  size: number;
  path: string;
  source: 'xenova' | 'hf';
}

const CACHE_BASE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'node_modules',
  '@xenova',
  'transformers',
  '.cache',
  'Xenova',
);

const HF_CACHE_BASE = path.join(os.homedir(), '.cache', 'huggingface', 'hub');
// @huggingface/transformers JS library writes to {cacheDir}/{org}/{model}/ (not
// the Python hub's models--{org}--{model} format).
const QWEN_CACHE_PATH = path.join(HF_CACHE_BASE, 'onnx-community', 'Qwen2.5-1.5B-Instruct');
const QWEN_MODEL_NAME = 'Qwen2.5-1.5B-Instruct';

export function getCachePaths(): { xenova: string; hf: string } {
  return { xenova: CACHE_BASE_PATH, hf: HF_CACHE_BASE };
}

async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  try {
    const files = await readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);

      if (file.isDirectory()) {
        totalSize += await getDirectorySize(filePath);
      } else {
        const stats = await stat(filePath);
        totalSize += stats.size;
      }
    }
  } catch (error) {
    console.error(`Error reading directory ${dirPath}:`, error);
  }

  return totalSize;
}

export async function listCachedModels(): Promise<CachedModel[]> {
  const models: CachedModel[] = [];

  try {
    if (fs.existsSync(CACHE_BASE_PATH)) {
      const modelDirs = await readdir(CACHE_BASE_PATH, { withFileTypes: true });

      for (const dir of modelDirs) {
        if (dir.isDirectory()) {
          const modelPath = path.join(CACHE_BASE_PATH, dir.name);
          const size = await getDirectorySize(modelPath);
          models.push({ name: dir.name, size, path: modelPath, source: 'xenova' });
        }
      }
    }
  } catch (error) {
    console.error('Error listing Xenova cached models:', error);
  }

  try {
    if (fs.existsSync(QWEN_CACHE_PATH)) {
      const size = await getDirectorySize(QWEN_CACHE_PATH);
      models.push({ name: QWEN_MODEL_NAME, size, path: QWEN_CACHE_PATH, source: 'hf' });
    }
  } catch (error) {
    console.error('Error listing HF cached models:', error);
  }

  return models.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteModel(modelName: string, source: 'xenova' | 'hf' = 'xenova'): Promise<boolean> {
  try {
    const modelPath = source === 'hf'
      ? QWEN_CACHE_PATH
      : path.join(CACHE_BASE_PATH, modelName);

    if (source === 'xenova' && !modelPath.startsWith(CACHE_BASE_PATH + path.sep)) {
      console.error(`[model-cache] Refusing to delete outside cache: ${modelPath}`);
      return false;
    }

    if (!fs.existsSync(modelPath)) {
      console.warn(`Model ${modelName} not found at ${modelPath}`);
      return false;
    }

    await rm(modelPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    console.error(`Error deleting model ${modelName}:`, error);
    return false;
  }
}

export async function clearAllCache(): Promise<number> {
  let deletedCount = 0;

  try {
    if (fs.existsSync(CACHE_BASE_PATH)) {
      const modelDirs = await readdir(CACHE_BASE_PATH, { withFileTypes: true });
      for (const dir of modelDirs) {
        if (dir.isDirectory()) {
          const success = await deleteModel(dir.name, 'xenova');
          if (success) deletedCount++;
        }
      }
    }
  } catch (error) {
    console.error('Error clearing Xenova cache:', error);
  }

  try {
    const qwenPath = QWEN_CACHE_PATH;
    if (fs.existsSync(qwenPath)) {
      await rm(qwenPath, { recursive: true, force: true });
      deletedCount++;
    }
  } catch (error) {
    console.error('Error clearing HF cache:', error);
  }

  return deletedCount;
}
