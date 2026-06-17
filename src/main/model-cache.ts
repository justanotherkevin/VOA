import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const rm = promisify(fs.rm);

export interface CachedModel {
  name: string;
  size: number;
  path: string;
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

export function getCachePaths(): string {
  return CACHE_BASE_PATH;
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
          models.push({ name: dir.name, size, path: modelPath });
        }
      }
    }
  } catch (error) {
    console.error('Error listing cached models:', error);
  }

  return models.sort((a, b) => a.name.localeCompare(b.name));
}

export async function deleteModel(modelName: string): Promise<boolean> {
  try {
    const modelPath = path.join(CACHE_BASE_PATH, modelName);

    if (!modelPath.startsWith(CACHE_BASE_PATH + path.sep)) {
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
          const success = await deleteModel(dir.name);
          if (success) deletedCount++;
        }
      }
    }
  } catch (error) {
    console.error('Error clearing cache:', error);
  }

  return deletedCount;
}
