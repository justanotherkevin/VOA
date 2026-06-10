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
  try {
    if (!fs.existsSync(CACHE_BASE_PATH)) {
      return [];
    }

    const modelDirs = await readdir(CACHE_BASE_PATH, { withFileTypes: true });
    const models: CachedModel[] = [];

    for (const dir of modelDirs) {
      if (dir.isDirectory()) {
        const modelPath = path.join(CACHE_BASE_PATH, dir.name);
        const size = await getDirectorySize(modelPath);

        models.push({
          name: dir.name,
          size,
          path: modelPath,
        });
      }
    }

    return models.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error listing cached models:', error);
    return [];
  }
}

export async function deleteModel(modelName: string): Promise<boolean> {
  try {
    const modelPath = path.join(CACHE_BASE_PATH, modelName);

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
  try {
    if (!fs.existsSync(CACHE_BASE_PATH)) {
      return 0;
    }

    const modelDirs = await readdir(CACHE_BASE_PATH, { withFileTypes: true });
    let deletedCount = 0;

    for (const dir of modelDirs) {
      if (dir.isDirectory()) {
        const success = await deleteModel(dir.name);
        if (success) {
          deletedCount++;
        }
      }
    }

    return deletedCount;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return 0;
  }
}
