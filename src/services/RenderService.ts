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
    const fontPath = path.join(this.ASSETS_DIR, 'fonts/Arimo-Variable.ttf');
    if (fs.existsSync(fontPath)) {
      registerFont(fontPath, { family: 'Arimo' });
    } else {
      Logger.info('Custom font not found. Using system sans-serif.');
    }
  }

  public async generate(data: ESRBData, outputPath: string, margin: number = 0, is4k: boolean = false): Promise<void> {
    const canvasWidth = is4k ? 3840 : 1920;
    const canvasHeight = is4k ? 2160 : 1080;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // 1. Black background (fills entire screen)
    ctx.fillStyle = '#1A1818';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    if (data.descriptors.length === 1 && data.descriptors[0] === 'No Descriptors') {
      let iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.svg`);
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.png`);
      }

      if (!fs.existsSync(iconPath)) {
        throw new Error(`Icon file not found for category ${data.ratingCategory}`);
      }

      let iconImage: any;
      let iconW = 0;
      let iconH = canvasHeight;

      if (iconPath.endsWith('.svg')) {
        const svgContent = fs.readFileSync(iconPath, 'utf-8');
        const wMatch = svgContent.match(/width="([^"]+)"/);
        const hMatch = svgContent.match(/height="([^"]+)"/);

        let originalW = 100;
        let originalH = 100;

        if (wMatch && hMatch) {
          originalW = parseFloat(wMatch[1]);
          originalH = parseFloat(hMatch[1]);
        }

        const ar = originalW / originalH;
        iconW = iconH * ar;

        // Modify SVG string to force high-resolution rasterization
        const modifiedSvg = svgContent
          .replace(/width="([^"]+)"/, `width="${iconW}"`)
          .replace(/height="([^"]+)"/, `height="${iconH}"`);

        iconImage = await loadImage(Buffer.from(modifiedSvg));
      } else {
        iconImage = await loadImage(iconPath);
        const ar = iconImage.width / iconImage.height;
        iconW = iconH * ar;
      }

      const iconX = (canvasWidth - iconW) / 2;
      const iconY = 0;

      ctx.drawImage(iconImage, iconX, iconY, iconW, iconH);

      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      Logger.info(`Slate saved to ${outputPath}`);
      return;
    }

    // Layout Constants
    const boxWidth = canvasWidth - (margin * 2);
    // Enforce 16:9 Aspect Ratio for the TOTAL drawing area
    const totalBoxHeight = boxWidth * (9 / 16);

    const startX = margin;
    // Center vertically
    const startY = (canvasHeight - totalBoxHeight) / 2;

    const hasInteractive = data.interactiveElements && data.interactiveElements.length > 0;

    // Determine heights
    let mainBoxHeight = totalBoxHeight;
    let interactiveBoxHeight = 0;

    if (hasInteractive) {
      // Allocate ~19.5% for interactive elements (30% increase from 15%)
      interactiveBoxHeight = totalBoxHeight * 0.195;
      mainBoxHeight = totalBoxHeight - interactiveBoxHeight;
    }

    // Use 650 as the "reference height" for scaling elements
    // Previous fixed height was 650.
    const referenceHeight = 650;
    const scaleFactor = mainBoxHeight / referenceHeight;

    // Scaled design constants
    const frameThickness = 22 * scaleFactor;
    const frameMargin = 10 * scaleFactor;
    const iconPadding = 4 * scaleFactor;
    const textPadding = 32 * scaleFactor;
    const fontSize = 75 * scaleFactor;
    const count = data.descriptors.length;
    // Dynamic gap calculation
    // Base gap is 10 * scaleFactor.
    // If 2 elements: gap = fontSize (75 * scaleFactor).
    // As count increases, gap decreases.
    const defaultGap = 10 * scaleFactor;
    let gap = defaultGap;
    if (count > 1) {
      // Formula: fontSize / (count - 1)
      // This gives 100% fontSize for N=2, 50% for N=3, etc.
      // We clamp it so it doesn't go below the default friendly gap.
      gap = Math.max(defaultGap, fontSize / (count - 1));
    }

    const currentLineHeight = fontSize + gap;

    // Calculate exact visual height of the text block (no gap after the last line)
    // Height = (N * fontSize) + ((N-1) * gap)
    const totalTextHeight = (count * fontSize) + (Math.max(0, count - 1) * gap);

    let textY = startY + (mainBoxHeight - totalTextHeight) / 2;

    // Safety check to ensure it doesn't overlap the top frame
    const frameInnerTop = startY + frameMargin + frameThickness;
    if (textY < frameInnerTop + 10) {
      textY = frameInnerTop + 10;
    }


    // 2. Main White Container
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(startX, startY, boxWidth, mainBoxHeight);

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
    const maxIconHeight = mainBoxHeight - (iconPadding * 2);

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

    const iconX = startX + iconPadding;
    const iconY = startY + iconPadding;

    // Draw Icon BEFORE the frame
    ctx.drawImage(iconImage, iconX, iconY, iconW, iconH);

    // 4. Draw Black Frame
    // Thickness and margin scaled logic
    const frameX = startX + frameMargin;
    const frameY = startY + frameMargin;
    const frameW = boxWidth - (frameMargin * 2);
    // Frame height strictly follows the white box, 
    // BUT if we have interactive section, we need to handle the bottom border carefully.
    // The main frame should enclose the main white box.
    // If hasInteractive, we want it to touch the bottom (no bottom margin)
    const frameH = hasInteractive
      ? mainBoxHeight - frameMargin
      : mainBoxHeight - (frameMargin * 2);

    ctx.beginPath();
    const halfStroke = frameThickness / 2;
    ctx.rect(
      frameX + halfStroke,
      frameY + halfStroke,
      frameW - frameThickness,
      frameH - frameThickness
    );
    ctx.lineWidth = frameThickness;
    ctx.strokeStyle = '#1A1818';
    ctx.stroke();

    // 5. Descriptors (Right Side)
    // Positioned relative to the icon's visual right edge (which is iconX + iconW)
    const textX = iconX + iconW + textPadding;
    const rightPadding = 20 * scaleFactor;

    // Constraint text width to fit within the frame (right side)
    // Frame inner right edge is: startX + boxWidth - frameMargin - frameThickness
    const frameInnerRight = startX + boxWidth - frameMargin - frameThickness;

    const maxTextWidth = frameInnerRight - textX - rightPadding;

    ctx.fillStyle = '#1A1818';
    ctx.font = `bold ${fontSize}px "Arimo", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    data.descriptors.forEach((desc, index) => {
      ctx.fillText(desc, textX, textY, maxTextWidth);
      // For the next line, move down by fontSize + gap
      // (which is currentLineHeight)
      textY += currentLineHeight;
    });

    // 7. Interactive Elements Footer
    if (hasInteractive) {
      const interactY = startY + mainBoxHeight; // Starts exactly where main box ends

      // Draw White Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(startX, interactY, boxWidth, interactiveBoxHeight);

      // Draw Black Frame for Footer
      // Should match the main frame style
      // The main frame used: frameX, frameY, frameW, frameH
      // Here: x is same. y is shifted. width same. height adapted.
      // Note: frameMargin creates a gap between Edge (startX) and Frame (frameX).
      // We want the footer frame to align with main frame.

      // Update logic: "Lower frame should be stretched in height and must touch the upper frame"
      // So we remove the top margin (gap) from the footer.
      // Upper frame ends at: startY + mainBoxHeight - 0 margin (visually)
      // Footer frame starts at: interactY (which is startY + mainBoxHeight).

      const footerFrameY = interactY - frameThickness; // Touch the line above
      // Footer height: interactiveBoxHeight - frameMargin (bottom margin only) + overlap
      const footerFrameH = interactiveBoxHeight - frameMargin + frameThickness;

      ctx.beginPath();
      // Calculate thinner stroke
      const footerThickness = frameThickness / 2;
      const footerHalfStroke = footerThickness / 2;

      ctx.rect(
        frameX + footerHalfStroke,
        footerFrameY + footerHalfStroke,
        frameW - footerThickness,
        footerFrameH - footerThickness
      );
      ctx.lineWidth = footerThickness;
      ctx.strokeStyle = '#1A1818';
      ctx.stroke();

      // Draw Text
      // Centered?
      const interactText = data.interactiveElements.slice(0, 3).join(', '); // Limit to 3 lines/items?
      // User examples: "Users Interact", "In-Game Purchases".
      // Font size? slightly smaller to ensure fit?
      // Or same size.
      const footerFontSize = fontSize * 1.04; // Increased by 30% from 0.8
      ctx.font = `bold ${footerFontSize}px "Arimo", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1A1818';

      const footerTextX = startX + (boxWidth / 2);
      // Center in the frame (which is footerFrameH tall), not the whole box
      const footerTextY = footerFrameY + (footerFrameH / 2);

      ctx.fillText(interactText, footerTextX, footerTextY, frameW - textPadding);
    }

    // 6. Save
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    Logger.info(`Slate saved to ${outputPath}`);
  }
}
