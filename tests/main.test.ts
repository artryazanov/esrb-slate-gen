import nock from 'nock';
import path from 'path';
import fs from 'fs';
import { ScraperService } from '../src/services/ScraperService';
import { RenderService } from '../src/services/RenderService';

const fixturePath = path.join(__dirname, 'fixtures', 'search_result.html');
const mockHTML = fs.readFileSync(fixturePath, 'utf-8');

describe('ESRB Generator Tests', () => {
  let scraper: ScraperService;
  let renderer: RenderService;

  beforeAll(() => {
    scraper = new ScraperService();
    renderer = new RenderService();
    // Ensure icons exist for renderer test
    // We already ran the download script in a previous step of the agent,
    // so assets/icons should be populated.
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('Scraper should parse game data correctly', async () => {
    nock('https://www.esrb.org')
      .get('/search/')
      .query(obj => {
        return obj.searchKeyword === 'Borderlands 2';
      })
      .reply(200, mockHTML);

    const data = await scraper.getGameData('Borderlands 2');

    expect(data.title).toBe('Borderlands 2');
    expect(data.ratingCategory).toBe('M');
    expect(data.descriptors).toContain('Blood and Gore');
    expect(data.descriptors).toContain('Use of Alcohol');
    expect(data.platforms).toContain('Windows PC');
  });

  test('Scraper should filter by platform', async () => {
    nock('https://www.esrb.org')
      .get('/search/')
      .query(true)
      .reply(200, mockHTML);

    const data = await scraper.getGameData('Borderlands 2', 'Windows PC');
    expect(data.title).toBe('Borderlands 2');
  });

  test('Scraper should throw if no result', async () => {
    nock('https://www.esrb.org')
      .get('/search/')
      .query(obj => obj.pg == '1')
      .reply(200, '<html></html>');

    nock('https://www.esrb.org')
      .get('/search/')
      .query(obj => obj.pg == '2')
      .reply(200, '<html></html>');

    nock('https://www.esrb.org')
      .get('/search/')
      .query(obj => obj.pg == '3')
      .reply(200, '<html></html>');

    await expect(scraper.getGameData('Unknown')).rejects.toThrow('not found');
  });

  test('Renderer should generate image without error', async () => {
    const data = {
      title: 'Test Game',
      ratingCategory: 'M',
      descriptors: ['Blood', 'Violence'],
      platforms: 'PC'
    };
    const outputPath = path.join(__dirname, 'test_output.png');

    try {
      await renderer.generate(data, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  });
  test('Renderer should generate simple icon for No Descriptors', async () => {
    const data = {
      title: 'Test Game No Desc',
      ratingCategory: 'T', // Use T as we know it exists
      descriptors: ['No Descriptors'],
      platforms: 'PC'
    };
    const outputPath = path.join(__dirname, 'test_output_nodesc.png');

    try {
      await renderer.generate(data, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      const stats = fs.statSync(outputPath);
      expect(stats.size).toBeGreaterThan(0);
    } finally {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  });
});
