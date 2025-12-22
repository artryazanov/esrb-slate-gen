import { RenderService } from '../src/services/RenderService';
import { createCanvas, Canvas, CanvasRenderingContext2D } from 'canvas';
import { ESRBData } from '../src/interfaces';
import fs from 'fs';
import path from 'path';

// Mock canvas
jest.mock('canvas', () => {
  const actualCanvas = jest.requireActual('canvas');
  return {
    ...actualCanvas,
    createCanvas: jest.fn(),
    loadImage: jest.fn().mockResolvedValue({ width: 100, height: 100 }), // Mock image
    registerFont: jest.fn(),
  };
});

describe('RenderService Font Size Constraints', () => {
  let mockContext: any;
  let mockCanvas: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    mockContext = {
      fillStyle: '',
      fillRect: jest.fn(),
      beginPath: jest.fn(),
      rect: jest.fn(),
      lineWidth: 0,
      strokeStyle: '',
      stroke: jest.fn(),
      font: '',
      textBaseline: '',
      textAlign: '',
      fillText: jest.fn(),
      measureText: jest.fn().mockReturnValue({ width: 50 }),
      drawImage: jest.fn(),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('')),
    };

    mockCanvas = {
      getContext: jest.fn().mockReturnValue(mockContext),
      toBuffer: jest.fn().mockReturnValue(Buffer.from('')),
    };

    (createCanvas as jest.Mock).mockReturnValue(mockCanvas);
  });

  it('should ensure interactive font size is not larger than descriptor font size', async () => {
    const renderer = new RenderService();
    const data: ESRBData = {
      title: 'Test Game',
      ratingCategory: 'M',
      descriptors: ['Blood', 'Violence'],
      interactiveElements: ['Users Interact'],
      platforms: 'PC',
    };

    // Need to mock fs.existsSync to true for icons so it doesn't fail
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    // Mock readFileSync for SVG logic if needed, but we mocked loadImage so it might pass if path doesn't end in svg
    // RenderService checks path extension. Let's assume it picks PNG if SVG check passes or falls back.
    // Actually RenderService code:
    // endsWith('.svg') -> readFileSync.
    // We should probably mock path.join to return something that definitely exists and isn't SVG to keep it simple, or mock readFileSync.

    // Let's just mock console.log to avoid noise
    jest.spyOn(console, 'log').mockImplementation(() => {});

    const outputPath = path.join(__dirname, '../output/test-output.png');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    await renderer.generate(data, outputPath);

    // Capture all font assignments
    // The code assigns font for descriptors, then later for footer (interactive)
    // We expect multiple assignments.

    // RenderService.ts logic:
    // We need to capture the assignments to mockContext.font.

    // We need to capture the assignments to mockContext.font.
    // Since mockContext is a plain object in our mock, we can just spy on the setter if we used a class, or check the assignments.
    // But `font` is a property.
    // We can use a proxy or just rely on the fact that we can't easily intercept property sets on a plain object unless we defineProperty.

    // Better idea: Mock the setter of the `font` property on the mockContext object.
    const fontValues: string[] = [];
    Object.defineProperty(mockContext, 'font', {
      set: (val) => {
        fontValues.push(val);
      },
      get: () => '',
    });

    // Create a new output path variable to avoid redeclaration or reuse carefully
    const secondOutputPath = path.join(__dirname, '../output/test-output.png');
    fs.mkdirSync(path.dirname(secondOutputPath), { recursive: true });
    await renderer.generate(data, secondOutputPath);

    console.log('Font values set:', fontValues);

    // Filter for the main font assignments we care about.
    // We expect:
    // 1. ctx.font = `bold ${descriptorFontSize}px ...`
    // 2. ctx.font = `bold ${footerFontSize}px ...`

    // We just need to parse these.

    const parseFontSize = (fontStr: string) => {
      const match = fontStr.match(/bold ([\d.]+)px/);
      return match ? parseFloat(match[1]) : 0;
    };

    const descriptorFontStr = fontValues.find(
      (v) => v.includes('Arimo') && !v.includes('undefined'),
    );
    // We expect the LAST two to be descriptor and then footer.

    // If there are only 2, great.
    const descriptorAssign = fontValues[0];
    const footerAssign = fontValues[1];

    const descSize = parseFontSize(descriptorAssign);
    const footerSize = parseFontSize(footerAssign);

    console.log(`Descriptor Size: ${descSize}, Footer Size: ${footerSize}`);

    expect(footerSize).toBeLessThanOrEqual(descSize);
  });
});
