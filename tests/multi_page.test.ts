import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';

const mockPage1HTML = `
<div class="game">
    <div class="heading">
        <h2><a href="/ratings/10010/DOOM+The+Dark+Ages">DOOM: The Dark Ages</a></h2>
        <div class="platforms">PC, PS5, Xbox Series</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
`;

const mockPage2HTML = `
<div class="game">
    <div class="heading">
        <h2><a href="/ratings/10020/DOOM">DOOM</a></h2>
        <div class="platforms">PC, PS4, Xbox One</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
`;

const mockDetailsDOOM = `
<html><body>
    <div class="synopsis-header"><h1>DOOM</h1></div>
    <div class="platforms-txt">PC, PS4, Xbox One</div>
    <div class="info-img"><img src="m.svg" /></div>
    <div class="description">Blood, Violence</div>
    <div class="other-info"><ul></ul></div>
</body></html>
`;

const mockDetailsDOOMDarkAges = `
<html><body>
    <div class="synopsis-header"><h1>DOOM: The Dark Ages</h1></div>
    <div class="platforms-txt">PC, PS5, Xbox Series</div>
    <div class="info-img"><img src="m.svg" /></div>
    <div class="description">Blood, Violence</div>
    <div class="other-info"><ul></ul></div>
</body></html>
`;

describe('ScraperService Multi-Page Search', () => {
  let scraper: ScraperService;

  beforeAll(() => {
    nock.disableNetConnect();
    scraper = new ScraperService();
  });

  afterAll(() => {
    nock.enableNetConnect();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test('should check page 2 if exact match is not found on page 1', async () => {
    // Mock Page 1 request (Partial match only)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '1')
      .reply(200, mockPage1HTML);

    // Mock Page 2 request (Exact match)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg === '2')
      .reply(200, mockPage2HTML);

    // Detail mock for DOOM
    nock('https://www.esrb.org').get('/ratings/10020/').reply(200, mockDetailsDOOM);

    const result = await scraper.getGameData('DOOM', 'PC');

    expect(result.title).toBe('DOOM');
  });

  test('should return page 1 exact match immediately without checking page 2', async () => {
    // Mock Page 1 request (Exact match found)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '1')
      .reply(200, mockPage2HTML); // Using page 2 content (which has exact match) as page 1

    // Detail mock for DOOM
    nock('https://www.esrb.org').get('/ratings/10020/').reply(200, mockDetailsDOOM);

    const result = await scraper.getGameData('DOOM', 'PC');

    expect(result.title).toBe('DOOM');
    // Verification: Since we only mocked Page 1, any attempt to call Page 2 would result in a network error
    // (because Nock blocks real network requests), confirming that the code did not proceed to Page 2.
  });

  test('should check page 3 if exact match is not found on page 1 or 2', async () => {
    // Mock Page 1 request (Partial match only)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '1')
      .reply(200, mockPage1HTML);

    // Mock Page 2 request (Nothing / Partial match that is worse)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '2')
      .reply(200, mockPage1HTML);

    // Mock Page 3 request (Exact match)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '3')
      .reply(200, mockPage2HTML); // Using page 2 content which has the exact match data we want

    // Detail mock for DOOM
    nock('https://www.esrb.org').get('/ratings/10020/').reply(200, mockDetailsDOOM);

    const result = await scraper.getGameData('DOOM', 'PC');

    expect(result.title).toBe('DOOM');
  });

  test('should fallback to partial match on page 1 if not found on page 2 or 3', async () => {
    // Mock Page 1 request (Partial match)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '1')
      .reply(200, mockPage1HTML);

    // Mock Page 2 request (Nothing / Partial match that is worse)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '2')
      .reply(200, '<html></html>'); // Empty results

    // Mock Page 3 request (Nothing)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'DOOM' && obj.pg == '3')
      .reply(200, '<html></html>');

    // Detail mock for DOOM: The Dark Ages (fallback)
    nock('https://www.esrb.org').get('/ratings/10010/').reply(200, mockDetailsDOOMDarkAges);

    const result = await scraper.getGameData('DOOM', 'PC');

    // Should fall back to "DOOM: The Dark Ages" from Page 1
    expect(result.title).toBe('DOOM: The Dark Ages');
  });
});
