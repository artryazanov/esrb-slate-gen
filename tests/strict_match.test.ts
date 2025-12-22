import nock from 'nock';
import { ScraperService } from '../src/services/ScraperService';

const mockAmbiguousHTML = `
<div class="game">
    <div class="heading">
        <h2><a href="/ratings/10001/Borderlands+2+VR">Borderlands 2 VR</a></h2> <!-- First result, partial match -->
        <div class="platforms">PlayStation 4, PC</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
<div class="game">
    <div class="heading">
        <h2><a href="/ratings/10002/Borderlands+2">Borderlands 2</a></h2> <!-- Second result, exact match -->
        <div class="platforms">PC, Xbox 360, PlayStation 3</div>
    </div>
    <div class="content"><img src="m.svg" /></div>
</div>
`;

const mockDetailsHTML_BL2 = `
<html>
<body>
    <div class="synopsis-header"><h1>Borderlands 2</h1></div>
    <div class="platforms-txt">PC, Xbox 360, PlayStation 3</div>
    <div class="info-img"><img src="m.svg" /></div>
    <div class="description">Blood and Gore, Intense Violence</div>
    <div class="other-info"><ul><li>Users Interact</li></ul></div>
</body>
</html>
`;

const mockDetailsHTML_BL2VR = `
<html>
<body>
    <div class="synopsis-header"><h1>Borderlands 2 VR</h1></div>
    <div class="platforms-txt">PlayStation 4, PC</div>
    <div class="info-img"><img src="m.svg" /></div>
    <div class="description">Blood and Gore, Intense Violence</div>
    <div class="other-info"><ul><li>Users Interact</li></ul></div>
</body>
</html>
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

    // Mock details for the exact match
    nock('https://www.esrb.org').get('/ratings/10002/').reply(200, mockDetailsHTML_BL2);

    // Searching for "Borderlands 2"
    // Current behavior (bug): Picks "Borderlands 2 VR" because it's first and includes "Borderlands 2".
    // Desired behavior: Pick "Borderlands 2" because it matches exactly.
    const result = await scraper.getGameData('Borderlands 2', 'PC');

    expect(result.title).toBe('Borderlands 2');
  });

  test('should prioritize exact match regardless of case', async () => {
    nock('https://www.esrb.org').get('/search/').query(true).reply(200, mockAmbiguousHTML);

    nock('https://www.esrb.org').get('/ratings/10002/').reply(200, mockDetailsHTML_BL2);

    const result = await scraper.getGameData('borderlands 2', 'PC');
    expect(result.title).toBe('Borderlands 2');
  });

  test('should fall back to partial match if no exact match found', async () => {
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'VR' && obj.pg == '1')
      .reply(200, mockAmbiguousHTML);

    // Mock Page 2 request (Nothing found)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'VR' && obj.pg == '2')
      .reply(200, '<html></html>');

    // Mock Page 3 request (Nothing found)
    nock('https://www.esrb.org')
      .get('/search/')
      .query((obj) => obj.searchKeyword === 'VR' && obj.pg == '3')
      .reply(200, '<html></html>');

    // Mock details for "Borderlands 2 VR" (partial match)
    nock('https://www.esrb.org').get('/ratings/10001/').reply(200, mockDetailsHTML_BL2VR);

    // "Borderlands 2 VR" is the only thing matching "VR"
    const result = await scraper.getGameData('VR', 'PC');
    expect(result.title).toBe('Borderlands 2 VR');
  });
});
