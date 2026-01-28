import * as fs from 'fs';
import * as path from 'path';
import { GeneratedCode } from '../services/claude';

export async function saveOutput(code: GeneratedCode, outputDir: string): Promise<void> {
  // Create output directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Save each file
  for (const file of code.files) {
    const filePath = path.join(outputDir, file.path);
    const fileDir = path.dirname(filePath);

    // Create subdirectories if needed
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    fs.writeFileSync(filePath, file.content, 'utf-8');
  }

  // Save instructions as README
  if (code.instructions) {
    const readmePath = path.join(outputDir, 'SETUP.md');
    fs.writeFileSync(readmePath, `# Setup Instructions\n\n${code.instructions}`, 'utf-8');
  }
}

export async function saveJson(data: any, filePath: string): Promise<void> {
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function readFile(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  return fs.readFileSync(filePath, 'utf-8');
}

export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}
