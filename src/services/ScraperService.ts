import axios from 'axios';
import * as cheerio from 'cheerio';
import { ESRBData } from '../interfaces';
import { Logger } from '../utils/logger';

export class ScraperService {
  private baseUrl = 'https://www.esrb.org/search/';

  public async getGameData(query: string, platform?: string): Promise<ESRBData> {
    try {
      Logger.info(`Searching for "${query}" on ESRB...`);
      const normalizedQuery = this.normalize(query);
      const normalizedPlatform = platform ? this.normalize(platform) : null;
      let page1Candidates: any[] = [];
      const MAX_PAGES = 3;

      for (let page = 1; page <= MAX_PAGES; page++) {
        if (page > 1) {
          Logger.info(`Exact match for "${query}" not found on page ${page - 1}. Checking page ${page}...`);
        }

        const candidates = await this.fetchCandidates(query, platform, page);

        if (page === 1) {
          page1Candidates = candidates;
        }

        const exactMatch = this.findExactMatch(candidates, normalizedQuery, normalizedPlatform);
        if (exactMatch) {
          return this.processGameResult(exactMatch.element, exactMatch.ratingImgSrc);
        }
      }

      // 5. Fallback: Use Page 1 results for partial matching or first result fallback
      const candidates = page1Candidates;
      // (As per requirements: "if exact match not found... take first game from first page")

      // Re-filter candidates from page 1 for platform if needed
      const platformFilteredCandidates = normalizedPlatform
        ? candidates.filter(c => c.platforms.includes(normalizedPlatform))
        : candidates;

      let targetGame: cheerio.Cheerio<any> | null = null;
      let ratingImgSrc = '';

      // Try Partial Title Match on Page 1
      const partialMatch = platformFilteredCandidates.find(c => c.title.includes(normalizedQuery));
      if (partialMatch) {
        targetGame = partialMatch.element;
        ratingImgSrc = partialMatch.ratingImgSrc;
      }

      // "Second Chance": Try to match ignoring platform (on Page 1)
      if (!targetGame && normalizedPlatform) {
        const exactMatchNoPlatform = candidates.find(c => c.title === normalizedQuery);
        if (exactMatchNoPlatform) {
          targetGame = exactMatchNoPlatform.element;
          ratingImgSrc = exactMatchNoPlatform.ratingImgSrc;
        } else {
          const partialMatchNoPlatform = candidates.find(c => c.title.includes(normalizedQuery));
          if (partialMatchNoPlatform) {
            targetGame = partialMatchNoPlatform.element;
            ratingImgSrc = partialMatchNoPlatform.ratingImgSrc;
          }
        }
      }

      // Ultimate Fallback: just take the first result from Page 1
      if (!targetGame) {
        if (candidates.length === 0) {
          throw new Error(`Game "${query}" not found.`);
        }
        targetGame = candidates[0].element;
        ratingImgSrc = candidates[0].ratingImgSrc;
        Logger.warn(`Specific match not found. Using top result: ${targetGame!.find('.heading a').text()}`);
      }

      return this.processGameResult(targetGame!, ratingImgSrc);

    } catch (error) {
      Logger.error(`Scraping failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private async fetchCandidates(query: string, platform: string | undefined, page: number) {
    const searchUrl = `${this.baseUrl}?searchKeyword=${encodeURIComponent(query)}&platform=${platform ? encodeURIComponent(platform) : 'All%20Platforms'}&pg=${page}`;

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

    const candidates: { element: cheerio.Cheerio<any>, title: string, platforms: string, ratingImgSrc: string }[] = [];

    gameResults.each((i, el) => {
      const currentElement = $(el);
      const titleText = this.normalize(currentElement.find('.heading a').text());
      const platformsText = this.normalize(currentElement.find('.platforms').text());
      const ratingImgSrc = currentElement.find('.content img').attr('src') || '';
      candidates.push({ element: currentElement, title: titleText, platforms: platformsText, ratingImgSrc });
    });

    return candidates;
  }

  private findExactMatch(candidates: any[], normalizedQuery: string, normalizedPlatform: string | null) {
    // Filter by platform first if provided
    const platformFiltered = normalizedPlatform
      ? candidates.filter(c => c.platforms.includes(normalizedPlatform))
      : candidates;

    return platformFiltered.find(c => c.title === normalizedQuery);
  }

  private processGameResult(gameElement: cheerio.Cheerio<any>, ratingImgSrc: string): ESRBData {
    const title = gameElement.find('.heading a').text().trim();
    const ratingCategory = this.extractRatingFromUrl(ratingImgSrc);
    const descriptorsText = gameElement.find('.content td').eq(1).text();

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
      platforms: gameElement.find('.platforms').text().trim()
    };
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
