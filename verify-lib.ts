import { RenderService, ESRBData } from './src/lib';
import path from 'path';

async function main() {
    const renderer = new RenderService();
    const data: ESRBData = {
        title: 'Test Game',
        ratingCategory: 'T',
        descriptors: ['Violence', 'Blood'],
        interactiveElements: [],
        platforms: 'PC'
    };

    const outputPath = path.join(__dirname, 'output', 'lib-test.png');
    console.log('Generating slate via library...');
    await renderer.generate(data, outputPath);
    console.log('Done!');
}

main().catch(console.error);
