import axios from 'axios';
import * as cheerio from 'cheerio';
import { ESRBData } from '../interfaces';
import { Logger } from '../utils/logger';

export class ScraperService {
  private baseUrl = 'https://www.esrb.org/search/';

  public async getGameData(query: string, platform?: string): Promise<ESRBData> {
    try {
      Logger.info(`Searching for "${query}" on ESRB...`);
      const searchUrl = `${this.baseUrl}?searchKeyword=${encodeURIComponent(query)}&platform=${platform ? encodeURIComponent(platform) : 'All%20Platforms'}`;

      const { data } = await axios.get(searchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.esrb.org/',
          'Connection': 'keep-alive'
        }
      });

      const $ = cheerio.load(data);
      const gameResults = $('.game');

      if (gameResults.length === 0) {
        throw new Error(`Game "${query}" not found.`);
      }

      let targetGame: cheerio.Cheerio<any> | null = null;

      if (platform) {
        gameResults.each((i, el) => {
            const currentElement = $(el);
            const platformsText = currentElement.find('.platforms').text().toLowerCase();
            const titleText = currentElement.find('.heading a').text().trim().toLowerCase();

            // Check if platform matches and title matches (fuzzy match logic could be better, but simple substring for now)
            if (platformsText.includes(platform.toLowerCase()) && titleText.includes(query.toLowerCase())) {
                 if (!targetGame) targetGame = currentElement;
            }
        });
      }

      // If no platform specific match found, or no platform provided, pick the first one that matches the title
      if (!targetGame) {
          gameResults.each((i, el) => {
              const currentElement = $(el);
              const titleText = currentElement.find('.heading a').text().trim().toLowerCase();
              if (titleText.includes(query.toLowerCase())) {
                  if (!targetGame) targetGame = currentElement;
                  return false; // break
              }
          });
      }

      // Fallback: just take the first result
      if (!targetGame) {
        targetGame = gameResults.first();
        Logger.warn(`Specific match not found. Using top result: ${targetGame.find('.heading a').text()}`);
      }

      const title = targetGame.find('.heading a').text().trim();
      const ratingImgSrc = targetGame.find('.content img').attr('src') || '';

      const ratingCategory = this.extractRatingFromUrl(ratingImgSrc);

      const descriptorsText = targetGame.find('.content td').eq(1).text();

      // Clean descriptors
      const cleanDescriptors = descriptorsText
       .replace(/^Content Descriptors:\s*/i, '')
       .split(/,\s*/)
       .map(d => d.trim())
       .filter(d => d.length > 0);

      Logger.info(`Found: ${title} [${ratingCategory}]`);

      return {
        title,
        ratingCategory,
        descriptors: cleanDescriptors,
        platforms: targetGame.find('.platforms').text().trim()
      };

    } catch (error) {
      Logger.error(`Scraping failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private extractRatingFromUrl(url: string): string {
    const filename = url.split('/').pop()?.toLowerCase() || '';
    if (filename.includes('e.svg') || filename.includes('e.png')) return 'E';
    if (filename.includes('e10plus') || filename.includes('everyone 10')) return 'E10plus';
    if (filename.includes('t.svg') || filename.includes('teen')) return 'T';
    if (filename.includes('m.svg') || filename.includes('mature')) return 'M';
    if (filename.includes('ao.svg')) return 'AO';
    if (filename.includes('rp.svg')) return 'RP';
    return 'RP';
  }
}
