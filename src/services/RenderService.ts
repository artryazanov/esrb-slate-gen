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

  public async generate(data: ESRBData, outputPath: string, margin: number = 0): Promise<void> {
    const canvas = createCanvas(this.WIDTH, this.HEIGHT);
    const ctx = canvas.getContext('2d');

    // 1. Black background (fills entire screen)
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Layout Constants
    const boxWidth = this.WIDTH - (margin * 2);
    // Enforce 16:9 Aspect Ratio
    const boxHeight = boxWidth * (9 / 16);

    const boxX = margin;
    // Center vertically
    const boxY = (this.HEIGHT - boxHeight) / 2;

    // Use 650 as the "reference height" for scaling elements
    // Previous fixed height was 650.
    const referenceHeight = 650;
    const scaleFactor = boxHeight / referenceHeight;

    // Scaled design constants
    const frameThickness = 24 * scaleFactor;
    const frameMargin = 10 * scaleFactor;
    const iconPadding = 4 * scaleFactor;
    const textPadding = 20 * scaleFactor;
    const fontSize = 75 * scaleFactor;
    const lineHeight = 85 * scaleFactor;
    const rightPadding = 20 * scaleFactor;

    // 2. Main White Container
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

    // 3. Load & Draw Icon (Left Side)
    // We prioritize the SVG and scale it up to prevent blurriness
    let iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.svg`);
    // Fallback to PNG if SVG missing
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.png`);
    }

    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon file not found for category ${data.ratingCategory}`);
    }

    // Determine target dimensions for the icon
    // It should fill the box height minus the small padding
    const maxIconHeight = boxHeight - (iconPadding * 2);

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
      // Fallback for PNG
      iconImage = await loadImage(iconPath);
      const ar = iconImage.width / iconImage.height;
      iconH = maxIconHeight;
      iconW = iconH * ar;
    }

    const iconX = boxX + iconPadding;
    const iconY = boxY + iconPadding;

    // Draw Icon BEFORE the frame
    ctx.drawImage(iconImage, iconX, iconY, iconW, iconH);

    // 4. Draw Black Frame
    // Thickness and margin scaled logic
    const frameX = boxX + frameMargin;
    const frameY = boxY + frameMargin;
    const frameW = boxWidth - (frameMargin * 2);
    const frameH = boxHeight - (frameMargin * 2);

    ctx.beginPath();
    const halfStroke = frameThickness / 2;
    ctx.rect(
      frameX + halfStroke,
      frameY + halfStroke,
      frameW - frameThickness,
      frameH - frameThickness
    );
    ctx.lineWidth = frameThickness;
    ctx.strokeStyle = '#000000';
    ctx.stroke();


    // 5. Descriptors (Right Side)
    // Positioned relative to the icon's visual right edge (which is iconX + iconW)
    const textX = iconX + iconW + textPadding;

    // Constraint text width to fit within the frame (right side)
    // Frame inner right edge is: boxX + boxWidth - frameMargin - frameThickness
    const frameInnerRight = boxX + boxWidth - frameMargin - frameThickness;

    const maxTextWidth = frameInnerRight - textX - rightPadding;

    ctx.fillStyle = '#000000';
    ctx.font = `bold ${fontSize}px "SlateFont", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // Calculate total height of text block to center it vertically
    const totalTextHeight = data.descriptors.length * lineHeight;
    let textY = boxY + (boxHeight - totalTextHeight) / 2;

    // Safety check to ensure it doesn't overlap the top frame
    const frameInnerTop = boxY + frameMargin + frameThickness;
    if (textY < frameInnerTop + 10) {
      textY = frameInnerTop + 10;
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
