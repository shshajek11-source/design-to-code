import Anthropic from '@anthropic-ai/sdk';
import { DesignSpec } from './gemini';

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
  private client: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required. Set it in .env file or environment variable.');
    }
    this.client = new Anthropic({ apiKey });
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

    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse code from Claude response');
    }

    return JSON.parse(jsonMatch[0]) as GeneratedCode;
  }

  async refactorCode(code: string, instructions: string): Promise<string> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `Refactor this code based on the following instructions:

Instructions: ${instructions}

Code:
\`\`\`
${code}
\`\`\`

Respond with ONLY the refactored code, no explanations.`
        }
      ]
    });

    return message.content[0].type === 'text' ? message.content[0].text : '';
  }

  async addFeature(code: string, feature: string, framework: string): Promise<GeneratedCode> {
    const message = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
      messages: [
        {
          role: 'user',
          content: `Add the following feature to this ${framework} code:

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

Respond ONLY with valid JSON.`
        }
      ]
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
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
}
