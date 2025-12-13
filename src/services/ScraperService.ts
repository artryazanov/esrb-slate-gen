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
      const normalizedQuery = this.normalize(query);
      const normalizedPlatform = platform ? this.normalize(platform) : null;

      const candidates: { element: cheerio.Cheerio<any>, title: string, platforms: string }[] = [];

      gameResults.each((i, el) => {
        const currentElement = $(el);
        const titleText = this.normalize(currentElement.find('.heading a').text());
        const platformsText = this.normalize(currentElement.find('.platforms').text());
        candidates.push({ element: currentElement, title: titleText, platforms: platformsText });
      });

      // 1. Try to find an EXACT match
      let exactMatch = candidates.find(c => {
        const titleMatch = c.title === normalizedQuery;
        const platformMatch = normalizedPlatform ? c.platforms.includes(normalizedPlatform) : true;
        return titleMatch && platformMatch;
      });

      // If exact match not found with platform, try exact match without platform constraint? 
      // No, user said "in result of search". The search itself might filter by platform if we strictly followed existing logic 
      // where we check platform manually. 
      // The previous logic filtered by platform MANUALLY in the loop. 
      // "Check if platform matches and title matches".
      // So I should valid candidates by platform first if platform is provided.

      const platformFilteredCandidates = normalizedPlatform
        ? candidates.filter(c => c.platforms.includes(normalizedPlatform))
        : candidates;

      // 1. Exact Title Match within platform-filtered candidates
      exactMatch = platformFilteredCandidates.find(c => c.title === normalizedQuery);

      if (exactMatch) {
        targetGame = exactMatch.element;
      } else {
        // 2. Partial Title Match (existing behavior)
        const partialMatch = platformFilteredCandidates.find(c => c.title.includes(normalizedQuery));
        if (partialMatch) {
          targetGame = partialMatch.element;
        }
      }

      // 3. Fallback to platform-filtered specific logic if above didn't find anything?
      // Actually previous logic had a fallback: 
      // "If no platform specific match found... pick the first one that matches the title [ignoring platform]"
      // Let's replicate this "Second Chance" logic.

      if (!targetGame && normalizedPlatform) {
        // Try to find exact match ignoring platform
        const exactMatchNoPlatform = candidates.find(c => c.title === normalizedQuery);
        if (exactMatchNoPlatform) {
          targetGame = exactMatchNoPlatform.element;
        } else {
          // Try partial match ignoring platform
          const partialMatchNoPlatform = candidates.find(c => c.title.includes(normalizedQuery));
          if (partialMatchNoPlatform) {
            targetGame = partialMatchNoPlatform.element;
          }
        }
      }

      // 4. Ultimate Fallback: just take the first result
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
    if (filename.includes('e10plus') || filename.includes('everyone 10') || filename.includes('e10+')) return 'E10plus';
    if (filename.includes('t.svg') || filename.includes('teen')) return 'T';
    if (filename.includes('m.svg') || filename.includes('mature')) return 'M';
    if (filename.includes('ao.svg')) return 'AO';
    if (filename.includes('rp.svg')) return 'RP';
    return 'RP';
  }

  private normalize(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
