import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const CONFIG_PATH = path.join(os.homedir(), '.design-to-code.json');

interface Config {
  geminiApiKey?: string;
  anthropicApiKey?: string;
  defaultFramework?: string;
  defaultOutputDir?: string;
}

function loadConfig(): Config {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (error) {
    // Ignore errors
  }
  return {};
}

function saveConfig(config: Config): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export const configCommand = new Command('config')
  .description('Configure API keys and settings')
  .argument('[action]', 'Action: set, show, init')
  .option('--gemini <key>', 'Set Gemini API key')
  .option('--anthropic <key>', 'Set Anthropic API key')
  .option('--framework <framework>', 'Set default framework')
  .option('--output <dir>', 'Set default output directory')
  .action(async (action: string | undefined, options) => {
    const config = loadConfig();

    // Handle direct options
    if (options.gemini) {
      config.geminiApiKey = options.gemini;
      saveConfig(config);
      console.log(chalk.green('✓ Gemini API key saved'));
      return;
    }

    if (options.anthropic) {
      config.anthropicApiKey = options.anthropic;
      saveConfig(config);
      console.log(chalk.green('✓ Anthropic API key saved'));
      return;
    }

    if (options.framework) {
      config.defaultFramework = options.framework;
      saveConfig(config);
      console.log(chalk.green(`✓ Default framework set to ${options.framework}`));
      return;
    }

    if (options.output) {
      config.defaultOutputDir = options.output;
      saveConfig(config);
      console.log(chalk.green(`✓ Default output directory set to ${options.output}`));
      return;
    }

    // Handle actions
    switch (action) {
      case 'show':
        console.log(chalk.cyan('\n⚙️  Current Configuration:\n'));
        console.log(chalk.white(`   Config file: ${CONFIG_PATH}`));
        console.log(chalk.white(`   Gemini API Key: ${config.geminiApiKey ? '***' + config.geminiApiKey.slice(-4) : 'Not set'}`));
        console.log(chalk.white(`   Anthropic API Key: ${config.anthropicApiKey ? '***' + config.anthropicApiKey.slice(-4) : 'Not set'}`));
        console.log(chalk.white(`   Default Framework: ${config.defaultFramework || 'nextjs'}`));
        console.log(chalk.white(`   Default Output: ${config.defaultOutputDir || './output'}`));
        console.log();

        // Check environment variables
        console.log(chalk.cyan('   Environment Variables:'));
        console.log(chalk.white(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? 'Set' : 'Not set'}`));
        console.log(chalk.white(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? 'Set' : 'Not set'}`));
        console.log();

        // Check OAuth/CLI status
        console.log(chalk.cyan('   Authentication Status:'));
        try {
          const { GeminiService } = await import('../services/gemini');
          const gemini = new GeminiService();
          const geminiAuth = await gemini.checkAuth();
          console.log(chalk.white(`   Gemini: ${geminiAuth.method} - ${geminiAuth.status}`));
        } catch (e: any) {
          console.log(chalk.white(`   Gemini: Error - ${e.message}`));
        }

        try {
          const { ClaudeService } = await import('../services/claude');
          const claude = new ClaudeService();
          const claudeAuth = await claude.checkAuth();
          console.log(chalk.white(`   Claude: ${claudeAuth.method} - ${claudeAuth.status}`));
        } catch (e: any) {
          console.log(chalk.white(`   Claude: Error - ${e.message}`));
        }
        console.log();
        break;

      case 'init':
      default:
        console.log(chalk.cyan('\n⚙️  Design-to-Code Configuration\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'geminiApiKey',
            message: 'Gemini API Key (from Google AI Studio):',
            default: config.geminiApiKey || '',
            transformer: (input) => input ? '***' + input.slice(-4) : ''
          },
          {
            type: 'input',
            name: 'anthropicApiKey',
            message: 'Anthropic API Key:',
            default: config.anthropicApiKey || '',
            transformer: (input) => input ? '***' + input.slice(-4) : ''
          },
          {
            type: 'list',
            name: 'defaultFramework',
            message: 'Default framework:',
            choices: ['nextjs', 'react', 'vue'],
            default: config.defaultFramework || 'nextjs'
          },
          {
            type: 'input',
            name: 'defaultOutputDir',
            message: 'Default output directory:',
            default: config.defaultOutputDir || './output'
          }
        ]);

        // Only update non-empty values
        if (answers.geminiApiKey) config.geminiApiKey = answers.geminiApiKey;
        if (answers.anthropicApiKey) config.anthropicApiKey = answers.anthropicApiKey;
        config.defaultFramework = answers.defaultFramework;
        config.defaultOutputDir = answers.defaultOutputDir;

        saveConfig(config);

        console.log(chalk.green('\n✓ Configuration saved!\n'));

        // Create .env file suggestion
        console.log(chalk.yellow('💡 Tip: You can also use a .env file in your project:'));
        console.log(chalk.white('   GEMINI_API_KEY=your_key_here'));
        console.log(chalk.white('   ANTHROPIC_API_KEY=your_key_here\n'));
        break;
    }
  });
