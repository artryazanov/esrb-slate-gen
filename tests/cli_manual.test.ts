import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

const cliPath = path.resolve(__dirname, '../src/index.ts');
const tsNodePath = path.resolve(__dirname, '../node_modules/.bin/ts-node');

function runCLI(args: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
        exec(`${tsNodePath} ${cliPath} ${args}`, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
                // We resolve even on error to check stderr/exit code in tests, 
                // but strictly `exec` yields error on non-zero exit.
                // easier to reject if strictly failing, but for validation tests we need the error.
                // Let's modify to return error as well if needed, or just reject.
                // actually better to just resolve with error attached or reject and catch.
                return reject({ error, stdout, stderr });
            }
            resolve({ stdout, stderr });
        });
    });
}

describe('CLI Manual Mode', () => {
    const outputDir = path.resolve(__dirname, '../test_output');

    beforeAll(() => {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir);
        }
    });

    afterAll(() => {
        // cleanup
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
    });

    test('should generate slate with manual rating and descriptors', async () => {
        const outputPath = path.join(outputDir, 'manual_test.png');
        const args = `--rating "T" --descriptors "Blood, Violence" --interactive "In-Game Purchases" -o "${outputPath}" --aspect-ratio 16:9`;

        const { stdout } = await runCLI(args);

        expect(stdout).toContain('Starting manual generation process');
        expect(stdout).toContain('Done.');
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should generate slate with only rating', async () => {
        const outputPath = path.join(outputDir, 'rating_only.png');
        const args = `--rating "E" -o "${outputPath}"`;

        const { stdout } = await runCLI(args);

        expect(stdout).toContain('Starting manual generation process');
        expect(stdout).toContain('Done.');
        expect(fs.existsSync(outputPath)).toBe(true);
    });

    test('should fail if no game/url and no rating provided', async () => {
        const args = `-o "should_fail.png"`;

        try {
            await runCLI(args);
            fail('Should have thrown an error');
        } catch (e: any) {
            expect(e.error.code).toBe(1);
            expect(e.stdout + e.stderr).toContain('Error: You must provide either a game title (-g), an ESRB URL (-u), or a manual rating (-r).');
        }
    });

    test('should fail if interactive elements is provided without rating (and no game)', async () => {
        // If I provide interactive but no rating and no game, it should fail
        const args = `--interactive "Users Interact"`;
        try {
            await runCLI(args);
            fail('Should have thrown an error');
        } catch (e: any) {
            expect(e.error.code).toBe(1);
            expect(e.stdout + e.stderr).toContain('Error: You must provide either a game title (-g), an ESRB URL (-u), or a manual rating (-r).');
        }
    });
});
