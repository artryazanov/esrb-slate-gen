import nock from 'nock';
import path from 'path';
import fs from 'fs';
import { ScraperService } from '../src/services/ScraperService';

const mockDetailsHTML = `
<html><body>
  <div class="synopsis-header"><h1>Cached Game</h1></div>
  <div class="platforms-txt">Unit Test Platform</div>
  <div class="info-img"><img src="m.svg" /></div>
  <div class="description">Cached Descriptors</div>
  <div class="other-info"><ul></ul></div>
</body></html>
`;

describe('ScraperService Caching', () => {
    let scraper: ScraperService;
    const cacheDir = path.resolve(process.cwd(), '.esrb-cache');
    const testId = 99999;
    const cacheFile = path.join(cacheDir, `${testId}.json`);

    beforeAll(() => {
        // Ensure cache dir exists (ScraperService ctor does this, but good to be sure)
        scraper = new ScraperService();
    });

    afterEach(() => {
        nock.cleanAll();
        // Clean up specific test cache file
        if (fs.existsSync(cacheFile)) {
            fs.unlinkSync(cacheFile);
        }
    });

    test('should fetch from network and save to cache on first call', async () => {
        // Mock network request
        const scope = nock('https://www.esrb.org')
            .get(`/ratings/${testId}/`)
            .reply(200, mockDetailsHTML);

        const data = await scraper.getGameParamsById(testId);

        expect(data.title).toBe('Cached Game');
        expect(scope.isDone()).toBe(true); // Network was hit
        expect(fs.existsSync(cacheFile)).toBe(true); // File was created

        const cachedContent = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        expect(cachedContent.title).toBe('Cached Game');
    });

    test('should read from cache on second call', async () => {
        // 1. Prime the cache
        fs.writeFileSync(cacheFile, JSON.stringify({
            title: 'Cached Game',
            ratingCategory: 'T',
            descriptors: ['Cached Descriptors'],
            platforms: 'Unit Test Platform',
            interactiveElements: []
        }));

        // 2. Mock network to fail (so we know if it tries to hit it)
        const scope = nock('https://www.esrb.org')
            .get(`/ratings/${testId}/`)
            .reply(500, 'Should not be called');

        const data = await scraper.getGameParamsById(testId);

        expect(data.title).toBe('Cached Game');
        expect(scope.isDone()).toBe(false); // Network was NOT hit
    });

    test('should ignore cache if force=true', async () => {
        // 1. Prime the cache with OLD data
        fs.writeFileSync(cacheFile, JSON.stringify({
            title: 'Old Title',
            ratingCategory: 'E',
            descriptors: [],
            platforms: '',
            interactiveElements: []
        }));

        // 2. Mock network with NEW data
        const scope = nock('https://www.esrb.org')
            .get(`/ratings/${testId}/`)
            .reply(200, mockDetailsHTML); // Returns "Cached Game"

        const data = await scraper.getGameParamsById(testId, true); // force=true

        expect(data.title).toBe('Cached Game'); // Should contain NEW data
        expect(scope.isDone()).toBe(true); // Network WAS hit

        // Check that cache was updated
        const cachedContent = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
        expect(cachedContent.title).toBe('Cached Game');
    });
});
