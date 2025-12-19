import { RenderService, ESRBData } from '../src/lib';
import path from 'path';
import fs from 'fs';

describe('Library Usage', () => {
    const outputDir = path.join(__dirname, 'output');
    const outputPath = path.join(outputDir, 'library_test.png');

    beforeAll(() => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
    });

    afterAll(() => {
        if (fs.existsSync(outputPath)) {
            fs.unlinkSync(outputPath);
        }
    });

    test('should export RenderService and generate slate', async () => {
        const renderer = new RenderService();
        const data: ESRBData = {
            title: 'Test Game',
            ratingCategory: 'T',
            descriptors: ['Violence', 'Blood'],
            interactiveElements: [],
            platforms: 'PC'
        };

        await renderer.generate(data, outputPath);

        expect(fs.existsSync(outputPath)).toBe(true);
    });
});
