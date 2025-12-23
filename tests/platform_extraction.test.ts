import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';
import { Logger } from '../src/utils/logger';
import fs from 'fs';

describe('ScraperService Platform Extraction', () => {
  let scraper: ScraperService;
  const gameId = 99999; // Using a dummy ID to avoid conflict
  // HTML simulating the issue with multiple platforms-txt elements
  const mockHtml = `
    <!DOCTYPE html>
    <html>
      <head></head>
      <body>
        <div class="synopsis-header">
           <h1>Buggy Game</h1>
        </div>
        <div class="platforms-txt">
           Correct Platform 1, Correct Platform 2
        </div>
        
        <div class="some-other-section">
             <div class="platforms-txt">
                Incorrect Duplicate Platform 1
             </div>
        </div>

        <div class="info-img">
           <img src="https://www.esrb.org/wp-content/themes/esrb/assets/images/M.svg" />
        </div>
        <div class="description">
           Violence
        </div>
      </body>
    </html>
  `;

  beforeAll(() => {
    nock.disableNetConnect();
    scraper = new ScraperService();
    // Mock Logger
    jest.spyOn(Logger, 'error').mockReturnThis();
    jest.spyOn(Logger, 'info').mockReturnThis();
    jest.spyOn(Logger, 'warn').mockReturnThis();

    // Mock fs.writeFileSync to avoid writing to real cache
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
  });

  afterAll(() => {
    nock.enableNetConnect();
    jest.restoreAllMocks();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should extract only the first platforms-txt occurance', async () => {
    nock('https://www.esrb.org').get(`/ratings/${gameId}/`).reply(200, mockHtml);

    // Using force=true to bypass cache reading
    const data = await scraper.getGameParamsById(gameId, true);

    expect(data.title).toBe('Buggy Game');
    // It should ONLY contain the first div's content
    expect(data.platforms).toBe('Correct Platform 1, Correct Platform 2');
    // Ensure it does NOT contain the second div's content
    expect(data.platforms).not.toContain('Incorrect Duplicate Platform 1');
    expect(data.esrbId).toBe(gameId);
    expect(data.esrbUrl).toBe(`https://www.esrb.org/ratings/${gameId}/`);
  });
});
