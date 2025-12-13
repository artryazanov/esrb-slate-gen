import { Command } from 'commander';
import path from 'path';
import { ScraperService } from './services/ScraperService';
import { RenderService } from './services/RenderService';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('esrb-gen')
  .description('Generates ESRB Rating Slates based on game title and platform')
  .version('1.0.0')
  .requiredOption('-g, --game <title>', 'Game title')
  .option('-p, --platform <platform>', 'Game platform (optional)')
  .option('-o, --output <path>', 'Output file path', 'output.png')
  .option('-m, --margin <number>', 'Margin from screen edges (default: 0)', '0')
  .action(async (options) => {
    try {
      const { game, platform, output, margin } = options;

      const scraper = new ScraperService();
      const renderer = new RenderService();

      Logger.info(`Starting process for game: "${game}"` + (platform ? ` on platform: "${platform}"` : ''));

      const data = await scraper.getGameData(game, platform);

      const outputPath = path.resolve(process.cwd(), output);
      await renderer.generate(data, outputPath, parseInt(margin, 10));

      Logger.info('Done.');
    } catch (error) {
      Logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
