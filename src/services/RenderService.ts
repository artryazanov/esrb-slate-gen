import { createCanvas, loadImage, registerFont, Image } from 'canvas';
import { ESRBData } from '../interfaces';
import fs from 'fs';
import path from 'path';
import { Logger } from '../utils/logger';

export class RenderService {
  private readonly WIDTH = 1920;
  private readonly HEIGHT = 1080;
  private ASSETS_DIR = path.join(__dirname, '../../assets');

  constructor(options?: { assetsDir?: string }) {
    if (options?.assetsDir) {
      this.ASSETS_DIR = options.assetsDir;
    }

    // Try to register custom font if exists, otherwise rely on system font
    const fontPath = path.join(this.ASSETS_DIR, 'fonts/Arimo-Variable.ttf');
    if (fs.existsSync(fontPath)) {
      registerFont(fontPath, { family: 'Arimo' });
    } else {
      Logger.info('Custom font not found. Using system sans-serif.');
    }
  }

  private async getIconAR(ratingCategory: string): Promise<number> {
    let iconPath = path.join(this.ASSETS_DIR, `icons/${ratingCategory}.svg`);
    // Fallback to PNG if SVG missing
    if (!fs.existsSync(iconPath)) {
      iconPath = path.join(this.ASSETS_DIR, `icons/${ratingCategory}.png`);
    }

    if (!fs.existsSync(iconPath)) {
      throw new Error(`Icon file not found for category ${ratingCategory}`);
    }

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
      return originalW / originalH;
    } else {
      const iconImage = await loadImage(iconPath);
      return iconImage.width / iconImage.height;
    }
  }

  public async generate(
    data: ESRBData,
    outputPath: string,
    margin: number = 0,
    is4k: boolean = false,
    heightFactor: number = 9 / 16,
  ): Promise<void> {
    const isVariableWidth = margin === 0;

    // Fixed height reference
    const fixedHeight = is4k ? 2160 : 1080;

    // Auto Aspect Ratio Logic
    if (heightFactor === 0) {
      Logger.info('Auto Aspect Ratio: calculating optimal width...');
      const iconAR = await this.getIconAR(data.ratingCategory);

      let found = false;

      // Filter descriptors for calculation (same as render logic)
      const filteredInteractive = (data.interactiveElements || []).filter(
        (el) => !el.toLowerCase().includes('not rated by the esrb'),
      );
      const hasInteractive = filteredInteractive.length > 0;

      // Use a temporary canvas for text measuring
      const tempCanvas = createCanvas(100, 100);
      const tempCtx = tempCanvas.getContext('2d');

      for (let w = 16; w <= 21; w++) {
        const hf = 9 / w;

        // Calculate Metrics for this HF
        let boxWidth: number;
        let totalBoxHeight: number;

        if (isVariableWidth) {
          // In variable width mode, height is fixed to screen height
          // Width expands
          totalBoxHeight = fixedHeight;
          boxWidth = totalBoxHeight / hf;
        } else {
          // In fixed width mode (margin > 0)
          const baseCanvasWidth = is4k ? 3840 : 1920;
          boxWidth = baseCanvasWidth - margin * 2;
          totalBoxHeight = boxWidth * hf;
        }

        let mainBoxHeight = totalBoxHeight;
        if (hasInteractive) {
          mainBoxHeight = totalBoxHeight * 0.805; // 1 - 0.195
        }

        const referenceHeight = 650;
        const scaleFactor = mainBoxHeight / referenceHeight;

        // Visual constants
        const frameThickness = 22 * scaleFactor;
        const frameMargin = 10 * scaleFactor;
        const iconPadding = 4 * scaleFactor;
        const textPadding = 32 * scaleFactor;
        const rightPadding = 20 * scaleFactor;

        // Max Text Width Calculation
        const startX = 0; // Relative to box

        // Icon width
        const maxIconHeight = mainBoxHeight - iconPadding * 2;
        const iconW = maxIconHeight * iconAR;
        const iconX = startX + iconPadding;

        const frameInnerRight = startX + boxWidth - frameMargin - frameThickness;
        const textX = iconX + iconW + textPadding;

        const maxTextWidth = frameInnerRight - textX - rightPadding;

        // Font Size
        const fontSize = 82 * scaleFactor;

        // Check if text fits width
        tempCtx.font = `bold ${fontSize}px "Arimo", Arial, sans-serif`;

        let allFit = true;
        for (const desc of data.descriptors) {
          const metrics = tempCtx.measureText(desc);
          if (metrics.width > maxTextWidth) {
            allFit = false;
            break;
          }
        }

        if (allFit) {
          Logger.info(`Auto Aspect Ratio: Found fit at ${w}:9`);
          heightFactor = hf;
          found = true;
          break;
        }
      }

      if (!found) {
        Logger.info('Auto Aspect Ratio: No perfect fit found, defaulting to 21:9');
        heightFactor = 9 / 21;
      }
    }

    // --- Final Rendering ---

    let canvasWidth: number;
    let canvasHeight: number;
    let boxWidth: number;
    let totalBoxHeight: number;
    let startX: number;
    let startY: number;

    if (isVariableWidth) {
      // Variable Width Mode
      // Height is fixed
      canvasHeight = fixedHeight;
      // Width is calculated from aspect ratio
      canvasWidth = canvasHeight / heightFactor;

      // Content fills the canvas
      boxWidth = canvasWidth;
      totalBoxHeight = canvasHeight;
      startX = 0;
      startY = 0;
    } else {
      // Legacy/Margin Mode
      canvasWidth = is4k ? 3840 : 1920;
      canvasHeight = fixedHeight;

      boxWidth = canvasWidth - margin * 2;
      totalBoxHeight = boxWidth * heightFactor;

      startX = margin;
      startY = (canvasHeight - totalBoxHeight) / 2;
    }

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext('2d');

    // 1. Background
    // If variable width (margin=0), we want White background (effectively transparent/full content)
    // If margin mode, we want Black background (letterboxing)
    if (isVariableWidth) {
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = '#1A1818';
    }
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // If No Descriptors case
    // Special handling for "No Descriptors" case.
    // Preserving variable width/canvas sizing logic calculated above,
    // ensuring consistency with the "auto" aspect ratio determination (likely 21:9 if empty).
    // The visual output will center the icon on the calculated canvas.
    if (data.descriptors.length === 1 && data.descriptors[0] === 'No Descriptors') {
      // Logic for No Descriptors:
      let iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.svg`);
      if (!fs.existsSync(iconPath)) {
        iconPath = path.join(this.ASSETS_DIR, `icons/${data.ratingCategory}.png`);
      }

      if (fs.existsSync(iconPath)) {
        // Draw background again just to be safe if we are here (though we just did)
        if (isVariableWidth) {
          // For Variable Width mode, using White background to maintain "no black bars" consistency.
          // Legacy mode remains Black.
          ctx.fillStyle = '#FFFFFF';
        } else {
          ctx.fillStyle = '#1A1818';
        }
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        let iconImage: Image;
        let iconW = 0;
        const iconH = canvasHeight; // Full height

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
        ctx.drawImage(iconImage, iconX, 0, iconW, iconH);

        const buffer = canvas.toBuffer('image/png');
        fs.writeFileSync(outputPath, buffer);
        Logger.info(`Slate saved to ${outputPath}`);
        return;
      }
    }

    // Filter out "Not Rated by the ESRB" from interactive elements
    const filteredInteractive = (data.interactiveElements || []).filter(
      (el) => !el.toLowerCase().includes('not rated by the esrb'),
    );

    const hasInteractive = filteredInteractive.length > 0;

    // Determine heights
    let mainBoxHeight = totalBoxHeight;
    let interactiveBoxHeight = 0;

    if (hasInteractive) {
      // Allocate ~19.5% for interactive elements
      interactiveBoxHeight = totalBoxHeight * 0.195;
      mainBoxHeight = totalBoxHeight - interactiveBoxHeight;
    }

    // Use 650 as the "reference height" for scaling elements
    const referenceHeight = 650;
    const scaleFactor = mainBoxHeight / referenceHeight;

    // Scaled design constants
    const frameThickness = 22 * scaleFactor;
    const frameMargin = 10 * scaleFactor;
    const iconPadding = 4 * scaleFactor;
    const textPadding = 32 * scaleFactor;

    // Calculate available height for text
    const frameH = hasInteractive ? mainBoxHeight - frameMargin : mainBoxHeight - frameMargin * 2;

    // Available vertical space inside the frame
    const availableTextHeight = frameH - frameThickness * 2 - 20 * scaleFactor;

    let fontSize = 82 * scaleFactor;
    const count = data.descriptors.length;
    let gap = 0;

    // Iteratively reduce font size until text fits with a minimum baseline gap
    for (let i = 0; i < 20; i++) {
      // Baseline gap (minimum comfortable spacing)
      const minGap = 0.25 * fontSize;

      const totalMinHeight = count * fontSize + Math.max(0, count - 1) * minGap;

      if (totalMinHeight <= availableTextHeight) {
        const remainingSpace = availableTextHeight - totalMinHeight;

        if (count > 1) {
          const extraPerItem = remainingSpace / (count + 2);
          gap = minGap + extraPerItem;
          // Cap the gap
          gap = Math.min(gap, 0.6 * fontSize);
        } else {
          gap = minGap;
        }
        break;
      }

      // If it doesn't fit, reduce font size by 5%
      fontSize *= 0.95;
    }

    const currentLineHeight = fontSize + gap;
    const totalTextHeight = count * fontSize + Math.max(0, count - 1) * gap;

    let textY = startY + (mainBoxHeight - totalTextHeight) / 2;

    const frameInnerTop = startY + frameMargin + frameThickness;
    if (textY < frameInnerTop + 10) {
      textY = frameInnerTop + 10;
    }

    // 2. Main White Container (The "Box")
    // If IS variable width, we already filled BG with white.
    // But we need to be careful. The "White Container" logic below assumes it draws a white rect at startX/Y.
    // If isVariableWidth, startX=0, startY=0, boxWidth=canvasWidth, mainBoxHeight.
    // This perfectly overlays correctly.
    // However, if we do the footer (interactive), mainBoxHeight is partial.
    // The interactive part is below.
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
    const maxIconHeight = mainBoxHeight - iconPadding * 2;

    let iconImage: Image;
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
    const frameX = startX + frameMargin;
    const frameY = startY + frameMargin;
    const frameW = boxWidth - frameMargin * 2;
    // Frame height logic

    ctx.beginPath();
    const halfStroke = frameThickness / 2;
    ctx.rect(
      frameX + halfStroke,
      frameY + halfStroke,
      frameW - frameThickness,
      frameH - frameThickness,
    );
    ctx.lineWidth = frameThickness;
    ctx.strokeStyle = '#1A1818';
    ctx.stroke();

    // 5. Descriptors (Right Side)
    const textX = iconX + iconW + textPadding;
    const rightPadding = 20 * scaleFactor;

    const frameInnerRight = startX + boxWidth - frameMargin - frameThickness;
    const maxTextWidth = frameInnerRight - textX - rightPadding;

    ctx.fillStyle = '#1A1818';
    ctx.font = `bold ${fontSize}px "Arimo", Arial, sans-serif`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';

    data.descriptors.forEach((desc) => {
      ctx.fillText(desc, textX, textY, maxTextWidth);
      textY += currentLineHeight;
    });

    // 7. Interactive Elements Footer
    if (hasInteractive) {
      const interactY = startY + mainBoxHeight;

      // Draw White Background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(startX, interactY, boxWidth, interactiveBoxHeight);

      // Draw Black Frame for Footer
      const footerFrameY = interactY - frameThickness;
      const footerFrameH = interactiveBoxHeight - frameMargin + frameThickness;

      ctx.beginPath();
      const footerThickness = frameThickness / 2;
      const footerHalfStroke = footerThickness / 2;

      ctx.rect(
        frameX + footerHalfStroke,
        footerFrameY + footerHalfStroke,
        frameW - footerThickness,
        footerFrameH - footerThickness,
      );
      ctx.lineWidth = footerThickness;
      ctx.strokeStyle = '#1A1818';
      ctx.stroke();

      // Draw Text
      const interactText = filteredInteractive.slice(0, 3).join(', ');

      const footerFontSize = fontSize;
      ctx.font = `bold ${footerFontSize}px "Arimo", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#1A1818';

      const footerTextX = startX + boxWidth / 2;
      const footerTextY = footerFrameY + footerFrameH / 2;

      ctx.fillText(interactText, footerTextX, footerTextY, frameW - textPadding);
    }

    // 6. Save
    const ext = path.extname(outputPath).toLowerCase();
    let buffer: Buffer;

    if (ext === '.jpg' || ext === '.jpeg') {
      buffer = canvas.toBuffer('image/jpeg');
    } else {
      buffer = canvas.toBuffer('image/png');
    }

    fs.writeFileSync(outputPath, buffer);
    Logger.info(`Slate saved to ${outputPath}`);
  }
}
