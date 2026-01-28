import Anthropic from '@anthropic-ai/sdk';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DesignSpec } from './gemini';

const execAsync = promisify(exec);

export interface GeneratedCode {
  files: CodeFile[];
  instructions: string;
}

export interface CodeFile {
  path: string;
  content: string;
  language: string;
}

export class ClaudeService {
  private client: Anthropic | null = null;
  private useClaudeCode: boolean = false;

  constructor() {
    // Try API key first, then Claude Code CLI
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
    } else {
      this.useClaudeCode = true;
    }
  }

  private async callClaudeCode(prompt: string): Promise<string> {
    // Write prompt to temp file
    const tempDir = os.tmpdir();
    const promptFile = path.join(tempDir, `d2c-prompt-${Date.now()}.txt`);
    const outputFile = path.join(tempDir, `d2c-output-${Date.now()}.txt`);

    fs.writeFileSync(promptFile, prompt);

    try {
      // Call Claude Code CLI with --print flag to get output
      const { stdout, stderr } = await execAsync(
        `claude --print "${prompt.substring(0, 500)}..." < "${promptFile}"`,
        { maxBuffer: 10 * 1024 * 1024, timeout: 300000 }
      );

      // Clean up
      fs.unlinkSync(promptFile);

      if (stderr && !stdout) {
        throw new Error(stderr);
      }

      return stdout;
    } catch (error: any) {
      // Try alternative: use claude with pipe
      try {
        const result = await this.runClaudeCodeInteractive(prompt);
        fs.unlinkSync(promptFile);
        return result;
      } catch (e: any) {
        fs.unlinkSync(promptFile);
        throw new Error(
          'Claude Code CLI not available or not logged in.\n' +
          'Run: claude login\n' +
          'Or set ANTHROPIC_API_KEY environment variable.\n' +
          `Original error: ${error.message}`
        );
      }
    }
  }

  private async runClaudeCodeInteractive(prompt: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: string[] = [];

      // Use claude with -p flag for prompt
      const claude = spawn('claude', ['-p', prompt], {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true
      });

      claude.stdout.on('data', (data) => {
        chunks.push(data.toString());
      });

      claude.stderr.on('data', (data) => {
        // Claude Code outputs progress to stderr, ignore it
      });

      claude.on('close', (code) => {
        if (code === 0 || chunks.length > 0) {
          resolve(chunks.join(''));
        } else {
          reject(new Error(`Claude Code exited with code ${code}`));
        }
      });

      claude.on('error', (err) => {
        reject(err);
      });

      // Timeout after 5 minutes
      setTimeout(() => {
        claude.kill();
        reject(new Error('Claude Code timeout'));
      }, 300000);
    });
  }

  private async callAPI(prompt: string): Promise<string> {
    if (this.useClaudeCode) {
      return this.callClaudeCode(prompt);
    }

    const message = await this.client!.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  }

  async generateCode(design: DesignSpec, framework: string = 'nextjs'): Promise<GeneratedCode> {
    const frameworkInstructions = this.getFrameworkInstructions(framework);

    const prompt = `You are an expert frontend developer. Generate production-ready code based on this design specification:

${JSON.stringify(design, null, 2)}

Framework: ${framework}
${frameworkInstructions}

Requirements:
1. Use TypeScript
2. Use Tailwind CSS for styling
3. Create reusable components
4. Follow best practices for the chosen framework
5. Include proper types/interfaces

Respond in this JSON format:
{
  "files": [
    {
      "path": "relative/path/to/file.tsx",
      "content": "file content here",
      "language": "typescript"
    }
  ],
  "instructions": "Setup and usage instructions"
}

Generate complete, working code. Respond ONLY with valid JSON.`;

    const responseText = await this.callAPI(prompt);

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse code from Claude response');
    }

    return JSON.parse(jsonMatch[0]) as GeneratedCode;
  }

  async refactorCode(code: string, instructions: string): Promise<string> {
    const prompt = `Refactor this code based on the following instructions:

Instructions: ${instructions}

Code:
\`\`\`
${code}
\`\`\`

Respond with ONLY the refactored code, no explanations.`;

    return this.callAPI(prompt);
  }

  async addFeature(code: string, feature: string, framework: string): Promise<GeneratedCode> {
    const prompt = `Add the following feature to this ${framework} code:

Feature: ${feature}

Current code:
\`\`\`
${code}
\`\`\`

Respond in JSON format:
{
  "files": [
    {
      "path": "relative/path/to/file.tsx",
      "content": "updated file content",
      "language": "typescript"
    }
  ],
  "instructions": "What was added and how to use it"
}

Respond ONLY with valid JSON.`;

    const responseText = await this.callAPI(prompt);
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse feature addition response');
    }

    return JSON.parse(jsonMatch[0]) as GeneratedCode;
  }

  private getFrameworkInstructions(framework: string): string {
    const instructions: Record<string, string> = {
      nextjs: `
- Use Next.js App Router (app directory)
- Create page.tsx for pages
- Use 'use client' directive where needed
- Implement proper metadata exports`,
      react: `
- Use functional components with hooks
- Create a proper component structure
- Use React.FC for component typing`,
      vue: `
- Use Vue 3 Composition API
- Use <script setup lang="ts">
- Create .vue single file components`
    };

    return instructions[framework] || instructions.react;
  }

  async checkAuth(): Promise<{ method: string; status: string }> {
    if (!this.useClaudeCode) {
      return { method: 'API Key', status: 'configured' };
    }
    try {
      // Check if claude command exists and is logged in
      await execAsync('claude --version');
      return { method: 'Claude Code CLI', status: 'available' };
    } catch {
      return { method: 'Claude Code CLI', status: 'not available' };
    }
  }
}
