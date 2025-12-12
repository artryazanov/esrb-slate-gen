import axios from 'axios';
import fs from 'fs';
import path from 'path';

const ICONS_DIR = path.join(__dirname, '../assets/icons');
const BASE_URL = 'https://www.esrb.org/wp-content/themes/esrb/assets/images/';

const icons = [
    'E', 'E10plus', 'T', 'M', 'AO', 'RP'
];

async function downloadFile(filename: string) {
    const url = `${BASE_URL}${filename}.svg`;
    const outputPath = path.join(ICONS_DIR, `${filename}.svg`);

    console.log(`Downloading ${url}...`);
    try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        fs.writeFileSync(outputPath, response.data);
        console.log(`Saved to ${outputPath}`);
    } catch (e: any) {
        console.error(`Failed to download ${filename}: ${e.message}`);
    }
}

async function main() {
    if (!fs.existsSync(ICONS_DIR)) {
        fs.mkdirSync(ICONS_DIR, { recursive: true });
    }
    for (const icon of icons) {
        await downloadFile(icon);
    }
}

main();
