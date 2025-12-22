import path from 'path';
import fs from 'fs';
import { RenderService } from '../src/services/RenderService';
import { ESRBData } from '../src/interfaces';
import { loadImage } from 'canvas';

// Mock data
const mockData: ESRBData = {
  title: 'Test Game',
  ratingCategory: 'M',
  descriptors: ['Blood', 'Violence'],
  platforms: 'Test Platform',
  interactiveElements: [],
};

describe('RenderService Aspect Ratio', () => {
  let renderer: RenderService;

  beforeAll(() => {
    renderer = new RenderService();
  });

  test('should generate 16:9 aspect ratio image (1920x1080)', async () => {
    const outputPath = path.join(__dirname, 'test_ar_16_9.png');
    try {
      // approx 16:9
      const hf = 9 / 16;
      await renderer.generate(mockData, outputPath, 0, false, hf);
      expect(fs.existsSync(outputPath)).toBe(true);

      const img = await loadImage(outputPath);
      expect(img.width).toBe(1920);
      expect(img.height).toBe(1080);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  test('should generate 21:9 aspect ratio image (Variable Width ~2520x1080)', async () => {
    const outputPath = path.join(__dirname, 'test_ar_21_9.png');
    try {
      // approx 21:9
      const hf = 9 / 21;
      await renderer.generate(mockData, outputPath, 0, false, hf);
      expect(fs.existsSync(outputPath)).toBe(true);

      const img = await loadImage(outputPath);
      // 1080 / (9/21) = 2520
      expect(img.width).toBe(2520);
      expect(img.height).toBe(1080);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  test('should generate auto aspect ratio image (Variable Width)', async () => {
    const outputPath = path.join(__dirname, 'test_ar_auto.png');
    const heightFactor = 0;

    // Short text -> 16:9 -> 1920x1080
    try {
      await renderer.generate(mockData, outputPath, 0, false, heightFactor);
      expect(fs.existsSync(outputPath)).toBe(true);
      const img = await loadImage(outputPath);
      expect(img.width).toBe(1920);
      expect(img.height).toBe(1080);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });

  test('should maintain 1920x1080 if margin is provided (Fixed Width)', async () => {
    const outputPath = path.join(__dirname, 'test_ar_margin.png');
    try {
      // 21:9 BUT with margin -> Fixed 1920x1080
      const hf = 9 / 21;
      const margin = 50;
      await renderer.generate(mockData, outputPath, margin, false, hf);

      expect(fs.existsSync(outputPath)).toBe(true);
      const img = await loadImage(outputPath);
      expect(img.width).toBe(1920);
      expect(img.height).toBe(1080);
    } finally {
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    }
  });
});
