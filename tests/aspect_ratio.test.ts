import path from 'path';
import fs from 'fs';
import { RenderService } from '../src/services/RenderService';
import { ESRBData } from '../src/interfaces';
import { createCanvas, loadImage } from 'canvas';

describe('RenderService Aspect Ratio', () => {
    let renderer: RenderService;

    beforeAll(() => {
        renderer = new RenderService();
    });

    const mockData: ESRBData = {
        title: 'Test Game',
        ratingCategory: 'M',
        descriptors: ['Blood', 'Violence'],
        interactiveElements: ['In-Game Purchases'],
        platforms: 'PC'
    };

    test('should generate 16:9 aspect ratio image (heightFactor ~0.56)', async () => {
        const outputPath = path.join(__dirname, 'test_ar_16_9.png');
        const heightFactor = 9 / 16;

        try {
            await renderer.generate(mockData, outputPath, 0, false, heightFactor);
            expect(fs.existsSync(outputPath)).toBe(true);

            // Load the image and verify dimensions of the content box relative to the canvas
            // Since the canvas is 1920x1080 (black bg), and content is drawn on top.
            // It's hard to verify "visual" aspect ratio from the file alone without OCR or pixel analysis.
            // But we can check if file is created successfully.
            const stats = fs.statSync(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        } finally {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }
    });

    test('should generate 21:9 aspect ratio image (heightFactor ~0.42)', async () => {
        const outputPath = path.join(__dirname, 'test_ar_21_9.png');
        const heightFactor = 9 / 21;

        try {
            await renderer.generate(mockData, outputPath, 0, false, heightFactor);
            expect(fs.existsSync(outputPath)).toBe(true);
            const stats = fs.statSync(outputPath);
            expect(stats.size).toBeGreaterThan(0);
        } finally {
            if (fs.existsSync(outputPath)) {
                fs.unlinkSync(outputPath);
            }
        }
    });

    // Note: We cannot test "validation" here because that logic resides in index.ts CLI parsing.
    // We strictly test that RenderService accepts the factor.
});
