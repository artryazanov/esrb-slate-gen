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
  .option('-o, --output <path>', 'Output file path', '/output/output.png')
  .option('-a, --aspect-ratio <ratio>', 'Content aspect ratio (e.g., 16:9, auto)', 'auto')
  .option('-m, --margin <number>', 'Margin from screen edges (default: 0)', '0')
  .option('--4k', 'Generate in 4K resolution (3840x2160)')
  .action(async (options) => {
    try {
      const { game, url, platform, output, margin, aspectRatio } = options;
      const is4k = !!options['4k'];

      if (!game && !url) {
        Logger.error('Error: You must provide either a game title (-g) or an ESRB URL (-u).');
        process.exit(1);
      }

      // Validate Aspect Ratio
      let heightFactor = 9 / 16;

      if (aspectRatio === 'auto') {
        heightFactor = 0; // 0 indicates auto mode
      } else {
        const ratioRegex = /^(\d+):(\d+)$/;
        const match = aspectRatio.match(ratioRegex);

        if (!match) {
          Logger.error('Error: Aspect ratio must be in the format W:H (e.g., 16:9) or "auto".');
          process.exit(1);
        }

        const widthRatio = parseInt(match[1], 10);
        const heightRatio = parseInt(match[2], 10);

        if (widthRatio <= 0 || heightRatio <= 0) {
          Logger.error('Error: Aspect ratio values must be positive integers.');
          process.exit(1);
        }

        const ratioValue = widthRatio / heightRatio;
        const minRatio = 16 / 9; // ~1.77
        const maxRatio = 21 / 9; // ~2.33

        if (ratioValue < minRatio || ratioValue > maxRatio) {
          Logger.error(`Error: Aspect ratio must be between 16:9 and 21:9. Provided: ${aspectRatio}`);
          process.exit(1);
        }

        heightFactor = heightRatio / widthRatio;
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

      await renderer.generate(data, outputPath, parseInt(margin, 10), is4k, heightFactor);

      Logger.info('Done.');
    } catch (error) {
      Logger.error(`Error: ${(error as Error).message}`);
      process.exit(1);
    }
  });

program.parse(process.argv);
