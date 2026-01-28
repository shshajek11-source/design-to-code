import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { GeminiService } from '../services/gemini';
import { saveJson } from '../utils/file';

export const designCommand = new Command('design')
  .description('Generate or analyze designs using Gemini')
  .argument('<action>', 'Action: generate, analyze, refine')
  .argument('[input]', 'Prompt text or image path')
  .option('-o, --output <file>', 'Output file path', './design-spec.json')
  .option('-d, --design <file>', 'Existing design file (for refine)')
  .action(async (action: string, input: string, options) => {
    const spinner = ora('Processing...').start();

    try {
      const gemini = new GeminiService();
      let result;

      switch (action) {
        case 'generate':
          if (!input) {
            spinner.fail('Prompt is required for generate action');
            process.exit(1);
          }
          spinner.text = 'Generating design with Gemini...';
          result = await gemini.generateDesign(input);
          break;

        case 'analyze':
          if (!input) {
            spinner.fail('Image path is required for analyze action');
            process.exit(1);
          }
          spinner.text = 'Analyzing image with Gemini...';
          result = await gemini.analyzeImage(input);
          break;

        case 'refine':
          if (!input || !options.design) {
            spinner.fail('Feedback and --design file are required for refine action');
            process.exit(1);
          }
          spinner.text = 'Refining design with Gemini...';
          const fs = await import('fs');
          const existingDesign = JSON.parse(fs.readFileSync(options.design, 'utf-8'));
          result = await gemini.refineDesign(existingDesign, input);
          break;

        default:
          spinner.fail(`Unknown action: ${action}. Use: generate, analyze, refine`);
          process.exit(1);
      }

      await saveJson(result, options.output);
      spinner.succeed(chalk.green(`Design saved to ${options.output}`));

      console.log(chalk.cyan('\nDesign Summary:'));
      console.log(chalk.white(`  Name: ${result.name}`));
      console.log(chalk.white(`  Description: ${result.description}`));
      console.log(chalk.white(`  Components: ${result.components?.length || 0}`));

    } catch (error: any) {
      spinner.fail(chalk.red(`Error: ${error.message}`));
      process.exit(1);
    }
  });
