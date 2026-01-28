#!/usr/bin/env node

import { Command } from 'commander';
import { config } from 'dotenv';
import chalk from 'chalk';
import { designCommand } from './commands/design';
import { codeCommand } from './commands/code';
import { generateCommand } from './commands/generate';
import { configCommand } from './commands/config';

config();

const program = new Command();

program
  .name('design-to-code')
  .description('CLI tool using Gemini for design and Claude for code generation')
  .version('1.0.0');

program.addCommand(designCommand);
program.addCommand(codeCommand);
program.addCommand(generateCommand);
program.addCommand(configCommand);

program
  .command('workflow')
  .description('Run full workflow: design with Gemini → code with Claude')
  .argument('<prompt>', 'Description of what you want to create')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('-f, --framework <framework>', 'Framework to use', 'nextjs')
  .action(async (prompt: string, options) => {
    console.log(chalk.cyan('\n🚀 Starting design-to-code workflow...\n'));

    try {
      // Step 1: Generate design with Gemini
      console.log(chalk.yellow('Step 1: Generating design with Gemini...'));
      const { GeminiService } = await import('./services/gemini');
      const gemini = new GeminiService();
      const design = await gemini.generateDesign(prompt);
      console.log(chalk.green('✓ Design generated\n'));

      // Step 2: Generate code with Claude
      console.log(chalk.yellow('Step 2: Generating code with Claude...'));
      const { ClaudeService } = await import('./services/claude');
      const claude = new ClaudeService();
      const code = await claude.generateCode(design, options.framework);
      console.log(chalk.green('✓ Code generated\n'));

      // Step 3: Save output
      console.log(chalk.yellow('Step 3: Saving files...'));
      const { saveOutput } = await import('./utils/file');
      await saveOutput(code, options.output);
      console.log(chalk.green(`✓ Files saved to ${options.output}\n`));

      console.log(chalk.cyan('🎉 Workflow completed successfully!'));
    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });

program.parse();
