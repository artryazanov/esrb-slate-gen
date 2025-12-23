import fs from 'fs';
import path from 'path';
import { ScraperService } from '../src/services/ScraperService';

// Mock dependencies
jest.mock('fs');
jest.mock('../src/utils/logger', () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('ScraperService Cache Directory', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should use default cache dir if accessible', () => {
    mockFs.existsSync.mockReturnValue(false);
    mockFs.mkdirSync.mockReturnValue(undefined as any);
    mockFs.accessSync.mockReturnValue(undefined);

    const service = new ScraperService();

    const expectedPath = path.resolve(process.cwd(), '.esrb-cache');
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(expectedPath, { recursive: true });
    // Verify that accessSync was called to check permissions
    expect(mockFs.accessSync).toHaveBeenCalledWith(expectedPath, expect.anything());
  });

  test('should use existing default cache dir without creating it', () => {
    mockFs.existsSync.mockReturnValue(true);
    mockFs.accessSync.mockReturnValue(undefined);

    new ScraperService();

    const expectedPath = path.resolve(process.cwd(), '.esrb-cache');
    expect(mockFs.mkdirSync).not.toHaveBeenCalled();
    expect(mockFs.accessSync).toHaveBeenCalledWith(expectedPath, expect.anything());
  });

  test('should fallback to /tmp if primary creation fails', () => {
    // 1. Primary path logic
    // existsSync(primary) -> false
    // mkdirSync(primary) -> THROWS

    // 2. Fallback path logic
    // accessSync(/tmp) -> OK
    // existsSync(fallback) -> false
    // mkdirSync(fallback) -> OK
    // accessSync(fallback) -> OK

    mockFs.existsSync.mockReturnValue(false);

    mockFs.mkdirSync
      .mockImplementationOnce(() => {
        throw new Error('Permission denied');
      })
      .mockImplementationOnce(() => undefined as any);

    mockFs.accessSync.mockImplementation(() => undefined);

    new ScraperService();

    // Check calls
    expect(mockFs.mkdirSync).toHaveBeenCalledTimes(2);

    // First attempt: local cache
    expect(mockFs.mkdirSync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining(process.cwd()),
      expect.anything(),
    );

    // Second attempt: fallback cache in /tmp
    expect(mockFs.mkdirSync).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/tmp'),
      expect.anything(),
    );
  });

  test('should use existing fallback cache dir without creating it', () => {
    // Primary fails
    mockFs.existsSync.mockReturnValueOnce(false); // Primary does not exist
    mockFs.mkdirSync.mockImplementationOnce(() => {
      throw new Error('Primary fail');
    });

    // Fallback logic
    mockFs.accessSync.mockImplementation(() => undefined); // All access checks pass
    mockFs.existsSync.mockReturnValueOnce(true); // Fallback DOES exist

    new ScraperService();

    // mkdirSync called ONCE for primary (failed), NOT for fallback
    expect(mockFs.mkdirSync).toHaveBeenCalledTimes(1);
    expect(mockFs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(process.cwd()),
      expect.anything(),
    );
  });

  test('should throw if both primary and fallback fail', () => {
    // Primary fails
    mockFs.mkdirSync.mockImplementation(() => {
      throw new Error('Fail');
    });
    // Fallback access fails
    mockFs.accessSync.mockImplementation(() => {
      throw new Error('Access denied');
    });

    expect(() => {
      new ScraperService();
    }).toThrow();
  });
});
