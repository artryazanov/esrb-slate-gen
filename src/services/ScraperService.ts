import axios from 'axios';
import * as cheerio from 'cheerio';
import { ESRBData } from '../interfaces';
import { Logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';

export class ScraperService {
  private baseUrl = 'https://www.esrb.org/search/';
  private cacheDir = path.resolve(process.cwd(), '.esrb-cache');

  constructor() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  private getCachePath(id: number): string {
    return path.join(this.cacheDir, `${id}.json`);
  }

  public async getGameParamsById(id: number, force: boolean = false): Promise<ESRBData> {
    const cachePath = this.getCachePath(id);

    if (!force && fs.existsSync(cachePath)) {
      try {
        const cached = fs.readFileSync(cachePath, 'utf-8');
        Logger.info(`Loaded game params from cache for ID: ${id}`);
        return JSON.parse(cached) as ESRBData;
      } catch (e) {
        Logger.warn(`Failed to read cache for ID ${id}, will fetch from network.`);
      }
    }

    const url = `https://www.esrb.org/ratings/${id}/`;
    try {
      Logger.info(`Fetching game data for ID: ${id}`);
      const { data } = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.esrb.org/',
          'Connection': 'keep-alive'
        }
      });

      const $ = cheerio.load(data);

      const title = $('.synopsis-header h1').text().trim();
      if (!title) {
        throw new Error('Could not extract game title from page.');
      }

      const platforms = $('.platforms-txt').first().text().trim();
      const ratingImgSrc = $('.info-img img').attr('src') || '';
      const ratingCategory = this.extractRatingFromUrl(ratingImgSrc);

      const descriptorsText = $('.description').text().trim();
      const descriptors = descriptorsText
        .split(/,\s*/)
        .map(d => d.trim())
        .filter(d => d.length > 0);

      const interactiveElements: string[] = [];
      $('.other-info ul li').each((i, el) => {
        const text = $(el).text().trim();
        if (text) interactiveElements.push(text);
      });

      const cleanInteractiveElements = interactiveElements
        .map(e => e.replace(/\s*\([^)]*\)/g, '').trim()) // Remove (...)
        .filter(e => e.length > 0);

      Logger.info(`Found: ${title} [${ratingCategory}]`);

      const result = {
        title,
        ratingCategory,
        descriptors,
        platforms,
        interactiveElements: cleanInteractiveElements
      };

      try {
        fs.writeFileSync(cachePath, JSON.stringify(result, null, 2));
        Logger.info(`Saved game params to cache for ID: ${id}`);
      } catch (e) {
        Logger.warn(`Failed to save cache for ID ${id}: ${(e as Error).message}`);
      }

      return result;

    } catch (error) {
      Logger.error(`Failed to fetch game params for ID ${id}: ${(error as Error).message}`);
      throw error;
    }
  }

  public async getGameData(query: string, platform?: string, force: boolean = false): Promise<ESRBData> {
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
          const id = this.extractIdFromUrl(exactMatch.url);
          if (id) {
            return this.getGameParamsById(id, force);
          }
        }
      }

      // 5. Fallback: Use Page 1 results for partial matching or first result fallback
      const candidates = page1Candidates;

      // Re-filter candidates from page 1 for platform if needed
      const platformFilteredCandidates = normalizedPlatform
        ? candidates.filter(c => c.platforms.includes(normalizedPlatform))
        : candidates;

      let targetGameUrl: string = '';

      // Try Partial Title Match on Page 1
      const partialMatch = platformFilteredCandidates.find(c => c.title.includes(normalizedQuery));
      if (partialMatch) {
        targetGameUrl = partialMatch.url;
      }

      // "Second Chance": Try to match ignoring platform (on Page 1)
      if (!targetGameUrl && normalizedPlatform) {
        const exactMatchNoPlatform = candidates.find(c => c.title === normalizedQuery);
        if (exactMatchNoPlatform) {
          targetGameUrl = exactMatchNoPlatform.url;
        } else {
          const partialMatchNoPlatform = candidates.find(c => c.title.includes(normalizedQuery));
          if (partialMatchNoPlatform) {
            targetGameUrl = partialMatchNoPlatform.url;
          }
        }
      }

      // Ultimate Fallback: just take the first result from Page 1
      if (!targetGameUrl) {
        if (candidates.length === 0) {
          throw new Error(`Game "${query}" not found.`);
        }
        targetGameUrl = candidates[0].url;
        Logger.warn(`Specific match not found. Using top result: ${candidates[0].title}`);
      }

      const id = this.extractIdFromUrl(targetGameUrl);
      if (!id) {
        throw new Error(`Could not extract ID from URL: ${targetGameUrl}`);
      }

      return this.getGameParamsById(id, force);

    } catch (error) {
      Logger.error(`Scraping failed: ${(error as Error).message}`);
      throw error;
    }
  }

  public async getGameDataFromUrl(url: string, force: boolean = false): Promise<ESRBData> {
    try {
      // Validate URL mask and extract ID
      const id = this.extractIdFromUrl(url);
      if (!id) {
        throw new Error('Invalid URL format. Expected: https://www.esrb.org/ratings/{id}/{slug}');
      }

      return this.getGameParamsById(id, force);
    } catch (error) {
      Logger.error(`Direct URL scraping failed: ${(error as Error).message}`);
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

    const candidates: { element: cheerio.Cheerio<any>, title: string, platforms: string, ratingImgSrc: string, url: string }[] = [];

    gameResults.each((i, el) => {
      const currentElement = $(el);
      const titleLink = currentElement.find('.heading a');
      const titleText = this.normalize(titleLink.text());
      const platformsText = this.normalize(currentElement.find('.platforms').text());
      const ratingImgSrc = currentElement.find('.content img').attr('src') || '';
      // Extract URL from the link
      const href = titleLink.attr('href') || '';
      const fullUrl = href.startsWith('http') ? href : `https://www.esrb.org${href}`;

      candidates.push({ element: currentElement, title: titleText, platforms: platformsText, ratingImgSrc, url: fullUrl });
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

  private extractIdFromUrl(url: string): number | null {
    const match = url.match(/\/ratings\/(\d+)\//);
    return match ? parseInt(match[1], 10) : null;
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
