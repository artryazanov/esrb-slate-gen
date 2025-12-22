import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';

import { Logger } from '../src/utils/logger';

describe('ScraperService URL Scraping', () => {
  let scraper: ScraperService;
  const validUrl = 'https://www.esrb.org/ratings/40649/borderlands-4/';
  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div class="synopsis-header">
           <h1>Borderlands 4</h1>
        </div>
        <div class="platforms-txt">
           Windows PC, PlayStation 5
        </div>
        <div class="info-img">
           <img src="https://www.esrb.org/wp-content/themes/esrb/assets/images/M.svg" />
        </div>
        <div class="description">
           Blood and Gore, Intense Violence, Sexual Themes, Strong Language
        </div>
        <div class="other-info">
          <ul>
            <li>Users Interact</li>
            <li>In-Game Purchases</li>
          </ul>
        </div>
        <div class="synopsis-retailers"></div>
      </body>
    </html>
  `;

  beforeAll(() => {
    scraper = new ScraperService();
    // Mock Logger to prevent noise in tests
    jest.spyOn(Logger, 'error').mockImplementation(() => ({}) as any);
    jest.spyOn(Logger, 'info').mockImplementation(() => ({}) as any);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should scrape game data correctly from valid URL', async () => {
    nock('https://www.esrb.org')
      .get('/ratings/40649/')
      .reply(200, mockHtml);

    const data = await scraper.getGameDataFromUrl(validUrl, true);

    expect(data.title).toBe('Borderlands 4');
    expect(data.ratingCategory).toBe('M');
    expect(data.descriptors).toEqual(['Blood and Gore', 'Intense Violence', 'Sexual Themes', 'Strong Language']);
    expect(data.interactiveElements).toEqual(['Users Interact', 'In-Game Purchases']);
    expect(data.platforms).toContain('Windows PC');
    expect(data.esrbId).toBe(40649);
    expect(data.esrbUrl).toBe('https://www.esrb.org/ratings/40649/');
  });

  test('should throw error for invalid URL format', async () => {
    const invalidUrl = 'https://www.google.com';
    await expect(scraper.getGameDataFromUrl(invalidUrl)).rejects.toThrow('Invalid URL format');
  });

  test('should throw error if title is not found', async () => {
    nock('https://www.esrb.org')
      .get('/ratings/40649/')
      .reply(200, '<html><body></body></html>');

    await expect(scraper.getGameDataFromUrl(validUrl, true)).rejects.toThrow('Could not extract game title');
  });

  test('should throw error on network failure', async () => {
    nock('https://www.esrb.org')
      .get('/ratings/40649/')
      .replyWithError('Network Error');

    await expect(scraper.getGameDataFromUrl(validUrl, true)).rejects.toThrow('Network Error');
  });
});
