import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';
import { Logger } from '../src/utils/logger';

describe('ScraperService ID Scraping', () => {
  let scraper: ScraperService;
  const validId = 40649;
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
      </body>
    </html>
  `;

  beforeAll(() => {
    nock.disableNetConnect();
    scraper = new ScraperService();
    // Mock Logger to prevent noise in tests
    jest.spyOn(Logger, 'error').mockReturnThis();
    jest.spyOn(Logger, 'info').mockReturnThis();
  });

  afterAll(() => {
    nock.enableNetConnect();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should scrape game data correctly from valid ID', async () => {
    nock('https://www.esrb.org').get(`/ratings/${validId}/`).reply(200, mockHtml);

    const data = await scraper.getGameParamsById(validId, true);

    expect(data.title).toBe('Borderlands 4');
    expect(data.ratingCategory).toBe('M');
    expect(data.descriptors).toEqual([
      'Blood and Gore',
      'Intense Violence',
      'Sexual Themes',
      'Strong Language',
    ]);
    expect(data.interactiveElements).toEqual(['Users Interact', 'In-Game Purchases']);
    expect(data.platforms).toContain('Windows PC');
    expect(data.esrbId).toBe(validId);
    expect(data.esrbUrl).toBe(`https://www.esrb.org/ratings/${validId}/`);
  });

  test('should throw error if title is not found', async () => {
    nock('https://www.esrb.org')
      .get(`/ratings/${validId}/`)
      .reply(200, '<html><body></body></html>');

    await expect(scraper.getGameParamsById(validId, true)).rejects.toThrow(
      'Could not extract game title',
    );
  });

  test('should throw error on network failure', async () => {
    nock('https://www.esrb.org').get(`/ratings/${validId}/`).replyWithError('Network Error');

    await expect(scraper.getGameParamsById(validId, true)).rejects.toThrow('Network Error');
  });
});
