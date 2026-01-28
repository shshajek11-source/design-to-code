import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import { GeminiService } from '../services/gemini';
import { ClaudeService } from '../services/claude';
import { saveOutput, saveJson } from '../utils/file';

export const generateCommand = new Command('generate')
  .description('Interactive design-to-code generation')
  .option('-o, --output <dir>', 'Output directory', './output')
  .option('--framework <framework>', 'Framework: nextjs, react, vue', 'nextjs')
  .action(async (options) => {
    console.log(chalk.cyan('\n🎨 Design-to-Code Interactive Generator\n'));

    try {
      // Step 1: Get design input
      const { inputType } = await inquirer.prompt([
        {
          type: 'list',
          name: 'inputType',
          message: 'How would you like to create your design?',
          choices: [
            { name: '📝 Describe it (text prompt)', value: 'text' },
            { name: '🖼️  Upload an image', value: 'image' }
          ]
        }
      ]);

      let design;
      const gemini = new GeminiService();
      const spinner = ora();

      if (inputType === 'text') {
        const { prompt } = await inquirer.prompt([
          {
            type: 'input',
            name: 'prompt',
            message: 'Describe what you want to create:',
            validate: (input) => input.length > 0 || 'Please enter a description'
          }
        ]);

        spinner.start('Generating design with Gemini...');
        design = await gemini.generateDesign(prompt);
        spinner.succeed('Design generated');
      } else {
        const { imagePath } = await inquirer.prompt([
          {
            type: 'input',
            name: 'imagePath',
            message: 'Enter the path to your design image:',
            validate: async (input) => {
              const fs = await import('fs');
              return fs.existsSync(input) || 'File not found';
            }
          }
        ]);

        spinner.start('Analyzing design image with Gemini...');
        design = await gemini.analyzeImage(imagePath);
        spinner.succeed('Design analyzed');
      }

      // Show design summary
      console.log(chalk.cyan('\n📋 Design Summary:'));
      console.log(chalk.white(`   Name: ${design.name}`));
      console.log(chalk.white(`   Description: ${design.description}`));
      console.log(chalk.white(`   Colors: ${Object.values(design.colorScheme || {}).join(', ')}`));
      console.log(chalk.white(`   Components: ${design.components?.length || 0}`));

      // Step 2: Refine design (optional)
      const { wantRefine } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'wantRefine',
          message: 'Would you like to refine the design?',
          default: false
        }
      ]);

      if (wantRefine) {
        const { feedback } = await inquirer.prompt([
          {
            type: 'input',
            name: 'feedback',
            message: 'What changes would you like?'
          }
        ]);

        spinner.start('Refining design...');
        design = await gemini.refineDesign(design, feedback);
        spinner.succeed('Design refined');
      }

      // Save design spec
      await saveJson(design, `${options.output}/design-spec.json`);
      console.log(chalk.green(`\n✓ Design saved to ${options.output}/design-spec.json`));

      // Step 3: Generate code
      const { generateCode } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'generateCode',
          message: 'Generate code from this design?',
          default: true
        }
      ]);

      if (generateCode) {
        const { framework } = await inquirer.prompt([
          {
            type: 'list',
            name: 'framework',
            message: 'Select framework:',
            choices: [
              { name: 'Next.js (App Router)', value: 'nextjs' },
              { name: 'React', value: 'react' },
              { name: 'Vue 3', value: 'vue' }
            ],
            default: options.framework
          }
        ]);

        spinner.start('Generating code with Claude...');
        const claude = new ClaudeService();
        const code = await claude.generateCode(design, framework);
        spinner.succeed('Code generated');

        await saveOutput(code, options.output);

        console.log(chalk.cyan('\n📁 Files created:'));
        code.files.forEach(f => console.log(chalk.white(`   - ${f.path}`)));

        console.log(chalk.cyan('\n📖 Setup Instructions:'));
        console.log(chalk.white(code.instructions));
      }

      console.log(chalk.green('\n🎉 Done! Your project is ready.\n'));

    } catch (error: any) {
      console.error(chalk.red(`\n❌ Error: ${error.message}`));
      process.exit(1);
    }
  });
