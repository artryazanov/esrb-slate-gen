import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D, Image } from 'canvas';
import { ESRBData } from '../interfaces';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

export class RenderService {
  private readonly WIDTH = 1920;
  private readonly HEIGHT = 1080;
  private readonly ASSETS_DIR = path.join(__dirname, '../../assets');

  // Rating Text Mapping
  private readonly RATING_TEXTS: Record<string, string> = {
    'E': 'EVERYONE',
    'E10plus': 'EVERYONE 10+',
    'T': 'TEEN',
    'M': 'MATURE 17+',
    'AO': 'ADULTS ONLY 18+',
    'RP': 'RATING PENDING'
  };

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
    const boxHeight = 650; // Approximated from aspect ratio
    const boxX = (this.WIDTH - boxWidth) / 2;
    const boxY = (this.HEIGHT - boxHeight) / 2;
    const borderThickness = 6;
    const padding = 40; // Inner padding

    // 2. Main White Border
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = borderThickness;
    ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

    // 3. Header Text ("MATURE 17+")
    const ratingText = this.RATING_TEXTS[data.ratingCategory] || data.ratingCategory.toUpperCase();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 72px "SlateFont", Arial, sans-serif'; // Large header font
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    // Position header just inside the box
    const headerY = boxY + padding;
    ctx.fillText(ratingText, boxX + padding, headerY);

    // Measure header height for content offset
    const headerHeight = 90;

    // 4. Content Area (Icon + Descriptors)
    const contentY = headerY + headerHeight;
    const contentHeight = boxHeight - (padding * 2) - headerHeight - 60; // 60 for footer

    // 5. Load Icon
    let iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.svg`);
    if (!fs.existsSync(iconPath)) {
         iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.png`);
    }

    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon file not found for category ${data.ratingCategory}`);
    }

    const icon = await loadImage(iconPath);

    // 6. Draw Icon (Cropped)
    // The retail icon has text on top and bottom. We want the middle part.
    // Assumptions based on standard ESRB retail badge (vertical rect):
    // Text ~15%, Icon ~70%, Text ~15%.
    // We want to draw just the "Icon" part.
    // However, for the "Trailer Slate", it usually looks like a White Box with the Black Letter.
    // The retail SVG is Black Letter on White Background.
    // So if we crop it, we get exactly that.

    const cropYPercent = 0.16; // Skip top 16% (Text)
    const cropHeightPercent = 0.60; // Take middle 60%
    const cropXPercent = 0.0;
    const cropWidthPercent = 1.0;

    const sX = icon.width * cropXPercent;
    const sY = icon.height * cropYPercent;
    const sW = icon.width * cropWidthPercent;
    const sH = icon.height * cropHeightPercent;

    // Destination
    const iconDestH = contentHeight;
    // Maintain aspect ratio of the CROP
    const cropAspectRatio = (sW as number) / (sH as number);
    const iconDestW = iconDestH * cropAspectRatio;

    const iconDestX = boxX + padding;
    const iconDestY = contentY;

    // Draw the cropped image
    // Note: sW/sH are usually needed to be accurate.
    // Canvas drawImage(image, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight)
    ctx.drawImage(icon, sX, sY, sW, sH, iconDestX, iconDestY, iconDestW, iconDestH);

    // 7. Divider Line
    const dividerX = iconDestX + iconDestW + 40;
    ctx.beginPath();
    ctx.moveTo(dividerX, contentY + 20);
    ctx.lineTo(dividerX, contentY + contentHeight - 20);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    // 8. Descriptors
    const textX = dividerX + 40;
    const maxTextWidth = (boxX + boxWidth) - textX - padding;

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 40px "SlateFont", Arial, sans-serif';
    ctx.textBaseline = 'top';

    const lineHeight = 50;
    // Center text vertically in the available content space?
    // Or start from top? Usually top aligned with the icon.
    // But let's center the block of text vertically relative to the content area.
    const totalTextHeight = data.descriptors.length * lineHeight;
    let textY = contentY + (contentHeight - totalTextHeight) / 2;

    // If text block is taller than content area (rare), clamp to top
    if (totalTextHeight > contentHeight) {
        textY = contentY;
    }

    data.descriptors.forEach(desc => {
      ctx.fillText(desc, textX, textY, maxTextWidth);
      textY += lineHeight;
    });

    // 9. Footer
    // "ESRB CONTENT RATING" (Left)
    // "www.esrb.org" (Right)
    const footerY = boxY + boxHeight - padding;

    ctx.font = 'bold 36px "SlateFont", Arial, sans-serif'; // Slightly smaller/different
    ctx.fillStyle = '#FFFFFF';
    ctx.textBaseline = 'bottom';

    ctx.textAlign = 'left';
    ctx.fillText('ESRB CONTENT RATING', boxX + padding, footerY);

    ctx.textAlign = 'right';
    ctx.fillText('www.esrb.org', boxX + boxWidth - padding, footerY);

    // 10. Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    Logger.info(`Slate saved to ${outputPath}`);
  }
}
