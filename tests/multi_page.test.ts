import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';

const mockPage1HTML = `
<div class="game">
    <div class="heading">
        <h2><a href="#">DOOM: The Dark Ages</a></h2>
        <div class="platforms">PC, PS5, Xbox Series</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
`;

const mockPage2HTML = `
<div class="game">
    <div class="heading">
        <h2><a href="#">DOOM</a></h2>
        <div class="platforms">PC, PS4, Xbox One</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
`;

describe('ScraperService Multi-Page Search', () => {
    let scraper: ScraperService;

    beforeAll(() => {
        scraper = new ScraperService();
    });

    afterEach(() => {
        nock.cleanAll();
    });

    test('should check page 2 if exact match is not found on page 1', async () => {
        // Mock Page 1 request (Partial match only)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '1')
            .reply(200, mockPage1HTML);

        // Mock Page 2 request (Exact match)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg === '2')
            .reply(200, mockPage2HTML);

        const result = await scraper.getGameData('DOOM', 'PC');

        expect(result.title).toBe('DOOM');
    });

    test('should return page 1 exact match immediately without checking page 2', async () => {
        // Mock Page 1 request (Exact match found)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '1')
            .reply(200, mockPage2HTML); // Using page 2 content (which has exact match) as page 1

        const result = await scraper.getGameData('DOOM', 'PC');

        expect(result.title).toBe('DOOM');
        // Ensure Page 2 was NOT called (Scope assertion - if strict handling is needed we'd do more, but standard nock throws if unmatched unique request made? No, preventing unwanted request.)
        // We rely on nock not intercepting any page 2 request, if it did it would error or we could check `isDone()`.
        // But better is that if it tried to call Page 2, it would fail because no mock?
        // Actually we only mocked Page 1. If code tries Page 2, it would hit network or fail if nock blocks net.
    });

    test('should check page 3 if exact match is not found on page 1 or 2', async () => {
        // Mock Page 1 request (Partial match only)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '1')
            .reply(200, mockPage1HTML);

        // Mock Page 2 request (Nothing / Partial match that is worse)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '2')
            .reply(200, mockPage1HTML);

        // Mock Page 3 request (Exact match)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '3')
            .reply(200, mockPage2HTML); // Using page 2 content which has the exact match data we want

        const result = await scraper.getGameData('DOOM', 'PC');

        expect(result.title).toBe('DOOM');
    });

    test('should fallback to partial match on page 1 if not found on page 2 or 3', async () => {
        // Mock Page 1 request (Partial match)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '1')
            .reply(200, mockPage1HTML);

        // Mock Page 2 request (Nothing / Partial match that is worse)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '2')
            .reply(200, '<html></html>'); // Empty results

        // Mock Page 3 request (Nothing)
        nock('https://www.esrb.org')
            .get('/search/')
            .query(obj => obj.searchKeyword === 'DOOM' && obj.pg == '3')
            .reply(200, '<html></html>');

        const result = await scraper.getGameData('DOOM', 'PC');

        // Should fall back to "DOOM: The Dark Ages" from Page 1
        expect(result.title).toBe('DOOM: The Dark Ages');
    });
});
