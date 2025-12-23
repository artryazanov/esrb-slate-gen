import axios from 'axios';
import fs from 'fs';
import path from 'path';

const ICONS_DIR = path.join(__dirname, '../assets/icons');
const FONTS_DIR = path.join(__dirname, '../assets/fonts');
const BASE_URL = 'https://www.esrb.org/wp-content/themes/esrb/assets/images/';
const FONT_URL =
  'https://raw.githubusercontent.com/google/fonts/main/apache/arimo/Arimo%5Bwght%5D.ttf';

const icons = ['E', 'E10plus', 'T', 'M', 'AO', 'RP'];

async function downloadFile(filename: string) {
  const url = `${BASE_URL}${filename}.svg`;
  const outputPath = path.join(ICONS_DIR, `${filename}.svg`);

  console.log(`Downloading ${url}...`);
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, response.data);
    console.log(`Saved to ${outputPath}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to download ${filename}: ${msg}`);
  }
}

async function downloadFont() {
  const outputPath = path.join(FONTS_DIR, 'Arimo-Variable.ttf');
  console.log(`Downloading Font from ${FONT_URL}...`);
  try {
    const response = await axios.get(FONT_URL, { responseType: 'arraybuffer' });
    fs.writeFileSync(outputPath, response.data);
    console.log(`Saved font to ${outputPath}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`Failed to download font: ${msg}`);
  }
}

async function main() {
  if (!fs.existsSync(ICONS_DIR)) {
    fs.mkdirSync(ICONS_DIR, { recursive: true });
  }
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  await downloadFont();

  for (const icon of icons) {
    await downloadFile(icon);
  }
}

main();
