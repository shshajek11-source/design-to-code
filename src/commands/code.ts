import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ClaudeService } from '../services/claude';
import { saveOutput, readFile } from '../utils/file';

export const codeCommand = new Command('code')
  .description('Generate or modify code using Claude')
  .argument('<action>', 'Action: generate, refactor, add-feature')
  .option('-d, --design <file>', 'Design spec file (for generate)')
  .option('-c, --code <file>', 'Code file (for refactor/add-feature)')
  .option('-i, --instructions <text>', 'Instructions for refactor')
  .option('-f, --feature <text>', 'Feature to add')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--framework <framework>', 'Framework: nextjs, react, vue', 'nextjs')
  .action(async (action: string, options) => {
    const spinner = ora('Processing...').start();

    try {
      const claude = new ClaudeService();

      switch (action) {
        case 'generate':
          if (!options.design) {
            spinner.fail('--design file is required for generate action');
            process.exit(1);
          }
          spinner.text = 'Generating code with Claude...';
          const designContent = await readFile(options.design);
          const design = JSON.parse(designContent);
          const generated = await claude.generateCode(design, options.framework);
          await saveOutput(generated, options.output);
          spinner.succeed(chalk.green(`Code generated in ${options.output}`));
          console.log(chalk.cyan('\nFiles created:'));
          generated.files.forEach(f => console.log(chalk.white(`  - ${f.path}`)));
          console.log(chalk.cyan('\nInstructions:'));
          console.log(chalk.white(generated.instructions));
          break;

        case 'refactor':
          if (!options.code || !options.instructions) {
            spinner.fail('--code and --instructions are required for refactor action');
            process.exit(1);
          }
          spinner.text = 'Refactoring code with Claude...';
          const codeContent = await readFile(options.code);
          const refactored = await claude.refactorCode(codeContent, options.instructions);
          const fs = await import('fs');
          fs.writeFileSync(options.code, refactored);
          spinner.succeed(chalk.green(`Code refactored: ${options.code}`));
          break;

        case 'add-feature':
          if (!options.code || !options.feature) {
            spinner.fail('--code and --feature are required for add-feature action');
            process.exit(1);
          }
          spinner.text = 'Adding feature with Claude...';
          const existingCode = await readFile(options.code);
          const updated = await claude.addFeature(existingCode, options.feature, options.framework);
          await saveOutput(updated, options.output);
          spinner.succeed(chalk.green(`Feature added, files saved to ${options.output}`));
          break;

        default:
          spinner.fail(`Unknown action: ${action}. Use: generate, refactor, add-feature`);
          process.exit(1);
      }

    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
