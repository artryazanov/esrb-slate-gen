import { createCanvas, loadImage, registerFont } from 'canvas';
import { ESRBData } from '../interfaces';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

export class RenderService {
  private readonly WIDTH = 1920;
  private readonly HEIGHT = 1080;
  private readonly ASSETS_DIR = path.join(__dirname, '../../assets');

  constructor() {
    // Try to register custom font if exists, otherwise rely on system font
    const fontPath = path.join(this.ASSETS_DIR, 'fonts/Arial-Bold.ttf');
    if (fs.existsSync(fontPath)) {
      registerFont(fontPath, { family: 'SlateFont' });
    } else {
      Logger.info('Custom font not found. Using system sans-serif.');
    }
  }

  public async generate(data: ESRBData, outputPath: string): Promise<void> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // 1. Black background
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Layout Constants
    const boxWidth = 1300;
    const boxHeight = 650;
    const boxX = (this.WIDTH - boxWidth) / 2;
    const boxY = (this.HEIGHT - boxHeight) / 2;
    const padding = 50;

    // 2. Main White Container
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // 3. Load & Draw Icon (Left Side)
    // We prioritize the SVG and scale it up to prevent blurriness
    let iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.svg`);
    // Fallback to PNG if SVG missing (though requirement implies SVG usage)
    if (!fs.existsSync(iconPath)) {
         iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.png`);
    }

    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon file not found for category ${data.ratingCategory}`);
    }

    // Determine target dimensions for the icon
    // It should fit within the box height minus padding
    const maxIconHeight = boxHeight - (padding * 2);

    let iconImage: any;
    let iconW = 0;
    let iconH = 0;

    if (iconPath.endsWith('.svg')) {
        const svgContent = fs.readFileSync(iconPath, 'utf-8');

        // Extract original dimensions to calculate Aspect Ratio
        const wMatch = svgContent.match(/width="([^"]+)"/);
        const hMatch = svgContent.match(/height="([^"]+)"/);

        let originalW = 100;
        let originalH = 100;

        if (wMatch && hMatch) {
            originalW = parseFloat(wMatch[1]);
            originalH = parseFloat(hMatch[1]);
        }

        const ar = originalW / originalH;

        // Calculate target width based on height constraint
        iconH = maxIconHeight;
        iconW = iconH * ar;

        // Modify SVG string to force high-resolution rasterization
        // We replace the width/height attributes with our target pixel values
        const modifiedSvg = svgContent
            .replace(/width="([^"]+)"/, `width="${iconW}"`)
            .replace(/height="([^"]+)"/, `height="${iconH}"`);

        iconImage = await loadImage(Buffer.from(modifiedSvg));
    } else {
        // Fallback for PNG (might be blurry)
        iconImage = await loadImage(iconPath);
        const ar = iconImage.width / iconImage.height;
        iconH = maxIconHeight;
        iconW = iconH * ar;
    }

    const iconX = boxX + padding;
    const iconY = boxY + padding;

    ctx.drawImage(iconImage, iconX, iconY, iconW, iconH);

    // 4. Divider Line (Black)
    // Positioned after the icon with some spacing
    const spacing = 50;
    const dividerX = iconX + iconW + spacing;

    ctx.beginPath();
    ctx.moveTo(dividerX, boxY + padding);
    ctx.lineTo(dividerX, boxY + boxHeight - padding);
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // 5. Descriptors (Right Side)
    // Black Text
    const textX = dividerX + spacing;
    const maxTextWidth = (boxX + boxWidth) - textX - padding;

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 54px "SlateFont", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left'; // Reset alignment

    const lineHeight = 65;

    // Calculate total height of text block to center it vertically
    const totalTextHeight = data.descriptors.length * lineHeight;
    let textY = boxY + (boxHeight - totalTextHeight) / 2;

    // Safety: don't go above top padding
    if (textY < boxY + padding) {
        textY = boxY + padding;
    }

    data.descriptors.forEach(desc => {
      ctx.fillText(desc, textX, textY, maxTextWidth);
      textY += lineHeight;
    });

    // 6. Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    Logger.info(`Slate saved to ${outputPath}`);
  }
}
