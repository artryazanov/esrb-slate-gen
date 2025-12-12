import { createCanvas, loadImage, registerFont, CanvasRenderingContext2D } from 'canvas';
import { ESRBData } from '../interfaces';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

export class RenderService {
  private readonly WIDTH = 1920;
  private readonly HEIGHT = 1080;
  private readonly SLATE_WIDTH = 900;
  private readonly SLATE_HEIGHT = 380;
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

    // 2. White container centered
    const containerX = (this.WIDTH - this.SLATE_WIDTH) / 2;
    const containerY = (this.HEIGHT - this.SLATE_HEIGHT) / 2;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(containerX, containerY, this.SLATE_WIDTH, this.SLATE_HEIGHT);

    // 3. Load icon
    // Try SVG first, then PNG
    let iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.svg`);
    if (!fs.existsSync(iconPath)) {
         iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.png`);
    }

    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon file not found for category ${data.ratingCategory}`);
    }

    const icon = await loadImage(iconPath);

    // 4. Draw icon (Left side)
    const padding = 30;
    const iconHeight = this.SLATE_HEIGHT - (padding * 2);
    // Maintain aspect ratio
    // SVG width/height might be different when loaded, but canvas handles it.
    // However, loadImage with SVG usually needs dimensions specified if not inherent,
    // but here we calculate draw dimensions.
    const aspectRatio = (icon.width as number) / (icon.height as number);
    const iconWidth = iconHeight * aspectRatio;

    ctx.drawImage(icon, containerX + padding, containerY + padding, iconWidth, iconHeight);

    // 5. Divider
    const dividerX = containerX + padding + iconWidth + 20;
    ctx.beginPath();
    ctx.moveTo(dividerX, containerY + padding);
    ctx.lineTo(dividerX, containerY + this.SLATE_HEIGHT - padding);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // 6. Descriptors (Right side)
    const textX = dividerX + 25;
    const maxTextWidth = (containerX + this.SLATE_WIDTH) - textX - padding;

    ctx.fillStyle = '#000000';
    // Use SlateFont if registered, else Arial/sans-serif
    ctx.font = 'bold 32px "SlateFont", Arial, sans-serif';
    ctx.textBaseline = 'top';

    const lineHeight = 40;
    const totalTextHeight = data.descriptors.length * lineHeight;
    let textY = containerY + (this.SLATE_HEIGHT - totalTextHeight) / 2;

    data.descriptors.forEach(desc => {
      // Basic text drawing. For very long descriptors, wrapping would be needed.
      // Assuming they fit for now as per report logic.
      ctx.fillText(desc, textX, textY, maxTextWidth);
      textY += lineHeight;
    });

    // 7. Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    Logger.info(`Slate saved to ${outputPath}`);
  }
}
