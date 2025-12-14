import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';

const mockAmbiguousHTML = `
<div class="game">
    <div class="heading">
        <h2><a href="#">Borderlands 2 VR</a></h2> <!-- First result, partial match -->
        <div class="platforms">PlayStation 4, PC</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
<div class="game">
    <div class="heading">
        <h2><a href="#">Borderlands 2</a></h2> <!-- Second result, exact match -->
        <div class="platforms">PC, Xbox 360, PlayStation 3</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
`;

describe('ScraperService Strict Matching', () => {
    let scraper: ScraperService;

    beforeAll(() => {
        scraper = new ScraperService();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    test('should prioritize exact match over partial match when exact match appears later', async () => {
        nock('https://www.esrb.org')
            .get('/search/')
            .query(true) // match any query
            .reply(200, mockAmbiguousHTML);

        // Searching for "Borderlands 2"
        // Current behavior (bug): Picks "Borderlands 2 VR" because it's first and includes "Borderlands 2".
        // Desired behavior: Pick "Borderlands 2" because it matches exactly.
        const result = await scraper.getGameData('Borderlands 2', 'PC');

        expect(result.title).toBe('Borderlands 2');
    });

    test('should prioritize exact match regardless of case', async () => {
        nock('https://www.esrb.org')
            .get('/search/')
            .query(true)
            .reply(200, mockAmbiguousHTML);

        const result = await scraper.getGameData('borderlands 2', 'PC');
        expect(result.title).toBe('Borderlands 2');
    });

    test('should fall back to partial match if no exact match found', async () => {
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'VR' && obj.pg == '1')
            .reply(200, mockAmbiguousHTML);

        // Mock Page 2 request (Nothing found)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'VR' && obj.pg == '2')
            .reply(200, '<html></html>');

        // Mock Page 3 request (Nothing found)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'VR' && obj.pg == '3')
            .reply(200, '<html></html>');

        // "Borderlands 2 VR" is the only thing matching "VR"
        const result = await scraper.getGameData('VR', 'PC');
        expect(result.title).toBe('Borderlands 2 VR');
    });
});
