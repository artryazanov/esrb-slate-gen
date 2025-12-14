import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import { ScraperService } from './services/ScraperService';
import { RenderService } from './services/RenderService';
import { Logger } from './utils/logger';

const program = new Command();

program
  .name('esrb-gen')
  .description('Generates ESRB Rating Slates based on game title and platform')
  .version('1.0.0')
  .option('-g, --game <title>', 'Game title')
  .option('-u, --url <url>', 'ESRB game URL')
  .option('-p, --platform <platform>', 'Game platform (optional)')
  .option('-o, --output <path>', 'Output file path', 'output/output.png')
  .option('-m, --margin <number>', 'Margin from screen edges (default: 0)', '0')
  .option('--4k', 'Generate in 4K resolution (3840x2160)')
  .action(async (options) => {
    try {
      const { game, url, platform, output, margin } = options;
      const is4k = !!options['4k'];

      if (!game && !url) {
        Logger.error('Error: You must provide either a game title (-g) or an ESRB URL (-u).');
        process.exit(1);
      }

      const scraper = new ScraperService();
      const renderer = new RenderService();

      let data;
      if (url) {
        Logger.info(`Starting process for URL: "${url}"`);
        if (is4k) Logger.info('Resolution: 4K (3840x2160)');
        data = await scraper.getGameDataFromUrl(url);
      } else {
        Logger.info(`Starting process for game: "${game}"` + (platform ? ` on platform: "${platform}"` : ''));
        if (is4k) Logger.info('Resolution: 4K (3840x2160)');
        data = await scraper.getGameData(game, platform);
      }

      const outputPath = path.resolve(process.cwd(), output);

      // Ensure output directory exists
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      await renderer.generate(data, outputPath, parseInt(margin, 10), is4k);

      Logger.info('Done.');
    } catch (error) {
      Logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
