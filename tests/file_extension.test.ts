import { RenderService } from '../src/services/RenderService';
import { ESRBData } from '../src/interfaces';
import fs from 'fs';
import path from 'path';
import { Canvas } from 'canvas';

// Mock canvas
const mockToBuffer = jest.fn();
jest.mock('canvas', () => {
  const originalModule = jest.requireActual('canvas');
  return {
    ...originalModule,
    createCanvas: jest.fn(() => ({
      getContext: jest.fn(() => ({
        beginPath: jest.fn(),
        rect: jest.fn(),
        fillRect: jest.fn(),
        fill: jest.fn(),
        stroke: jest.fn(),
        drawImage: jest.fn(),
        fillText: jest.fn(),
        measureText: jest.fn(() => ({ width: 0 })),
        save: jest.fn(),
        restore: jest.fn(),
        scale: jest.fn(),
        translate: jest.fn(),
        clip: jest.fn(),
        closePath: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        quadraticCurveTo: jest.fn(),
        arc: jest.fn(),
        globalCompositeOperation: 'source-over',
      })),
      toBuffer: mockToBuffer,
      width: 1920,
      height: 1080,
    })),
    loadImage: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    registerFont: jest.fn(),
  };
});

// Mock fs
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  writeFileSync: jest.fn(),
  existsSync: jest.fn(() => true), // Mock existsSync to avoid downloading assets
}));

describe('RenderService File Extensions', () => {
  let renderer: RenderService;
  const mockData: ESRBData = {
    title: 'Test Game',
    ratingCategory: 'E',
    descriptors: ['Mild Fantasy Violence'],
    interactiveElements: [],
    platforms: 'PC',
  };

  beforeAll(() => {
    renderer = new RenderService();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockToBuffer.mockReturnValue(Buffer.from('mock-image-data'));
  });

  test('should save as PNG when extension is .png', async () => {
    const outputPath = path.resolve('output/test.png');
    await renderer.generate(mockData, outputPath);

    expect(mockToBuffer).toHaveBeenCalledWith('image/png');
    expect(fs.writeFileSync).toHaveBeenCalledWith(outputPath, expect.any(Buffer));
  });

  test('should save as JPEG when extension is .jpg', async () => {
    const outputPath = path.resolve('output/test.jpg');
    await renderer.generate(mockData, outputPath);

    expect(mockToBuffer).toHaveBeenCalledWith('image/jpeg');
    expect(fs.writeFileSync).toHaveBeenCalledWith(outputPath, expect.any(Buffer));
  });

  test('should save as JPEG when extension is .jpeg', async () => {
    const outputPath = path.resolve('output/test.jpeg');
    await renderer.generate(mockData, outputPath);

    expect(mockToBuffer).toHaveBeenCalledWith('image/jpeg');
    expect(fs.writeFileSync).toHaveBeenCalledWith(outputPath, expect.any(Buffer));
  });

  test('should fallback to PNG for unknown extension', async () => {
    const outputPath = path.resolve('output/test.bmp');
    await renderer.generate(mockData, outputPath);

    expect(mockToBuffer).toHaveBeenCalledWith('image/png');
    expect(fs.writeFileSync).toHaveBeenCalledWith(outputPath, expect.any(Buffer));
  });
});
