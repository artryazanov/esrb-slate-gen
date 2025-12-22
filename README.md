# ESRB Rating Slate Generator

A Node.js-based tool for generating broadcast-compliant ESRB Rating Slates. This application can **scrape** the official [ESRB website](https://www.esrb.org) for game data or generate slates from **manual input**, rendering high-resolution PNG images suitable for video trailers.

It can be used as a **Command Line Interface (CLI)** or imported as a **TypeScript/Node.js Library**.

<img src="https://raw.githubusercontent.com/artryazanov/esrb-slate-gen/main/esrb-slate-example.png" alt="ESRB Slate Example" width="640" />

_Example generation for [Borderlands 4](https://www.esrb.org/ratings/40649/borderlands-4/)_

[![CI](https://github.com/artryazanov/esrb-slate-gen/actions/workflows/ci.yml/badge.svg)](https://github.com/artryazanov/esrb-slate-gen/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![npm version](https://img.shields.io/npm/v/esrb-slate-gen.svg)](https://www.npmjs.com/package/esrb-slate-gen)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=flat&logo=jest&logoColor=white)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat)](https://github.com/prettier/prettier)

## Features

- **Dual Mode:** Works as a CLI tool and an importable Library.
- **Automated Scraping:** Fetches rating category and content descriptors directly from ESRB.org.
- **Manual Mode:** Generate slates by manually specifying rating, descriptors, and interactive elements.
- **Platform Filtering:** Optional filtering to target specific game versions (e.g., PS5 vs Xbox).
- **High-Quality Rendering:** Generates 1920x1080 (Full HD) images with correct layout and standard icons.
- **Docker Support:** Fully containerized environment ensuring consistent font and graphics rendering.
- **Caching:** Caches scraped data locally to reduce network requests.
- **TypeScript:** Type-safe codebase.

## Prerequisites

- **Docker** (Recommended for CLI)
- _OR_ **Node.js v18+** with system dependencies for `node-canvas` (libcairo, libpango) installed (for Library/Local usage).

---

## 1. CLI Usage

### Using Docker

1.  **Build the image:**

    ```bash
    docker build -t esrb-gen .
    ```

2.  **Run the generator:**
    Mount the current directory to `/output` inside the container to save the file locally.

    ```bash
    docker run --rm \
      -v $(pwd)/output:/output \
      -v $(pwd)/.esrb-cache:/app/.esrb-cache \
      esrb-gen \
      --game "Borderlands 4" \
      --platform "PC" \
      --output "/output/my-slate.png"
    ```

    > [!NOTE]
    > To make caching work across Docker runs (which are ephemeral), you must mount the `.esrb-cache` directory to `/app/.esrb-cache` inside the container as shown above.

### Using NPM (Node.js)

You can use the tool directly via `npx` or by installing it globally.

**Quick Run (npx):**
Since the package name (`esrb-slate-gen`) differs from the binary command (`esrb-gen`), use the `-p` flag:

```bash
npx -p esrb-slate-gen esrb-gen --game "God of War"
```

**Global Installation:**

```bash
npm install -g esrb-slate-gen

# Usage
esrb-gen --url "https://www.esrb.org/ratings/40649/borderlands-4/"
```

**Manual Generation Example:**

```bash
# If installed globally:
esrb-gen -r "M" -d "Blood, Violence" -i "In-Game Purchases"

# Or via npx:
npx -p esrb-slate-gen esrb-gen -r "M" -d "Blood, Violence" -i "In-Game Purchases"
```

## 2. Library Usage

You can use `esrb-slate-gen` typically as a dependency in your own Node.js project.

### Installation

```bash
npm install esrb-slate-gen
```

### Example Code

```typescript
import { ScraperService, RenderService, ESRBData } from 'esrb-slate-gen';
import path from 'path';

async function generateSlate() {
  // 1. Get Data (scrape or create manually)
  const scraper = new ScraperService();
  const data = await scraper.getGameData('Hades', 'PC');

  // OR Manual Data:
  /*
  const data: ESRBData = {
    title: 'My Game',
    ratingCategory: 'T',
    descriptors: ['Fantasy Violence'],
    interactiveElements: []
  };
  */

  // 2. Render Image
  // You can optionally pass specific assets directory if needed
  const renderer = new RenderService();

  await renderer.generate(
    data,
    path.join(__dirname, 'output.png'),
    0, // margin (0 = variable width/fullscreen)
    false, // is4k
    9 / 16, // heightFactor (or pass 0 for auto-calculation)
  );
}

generateSlate();
```

---

## CLI Options

| Option&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Alias | Description                                                                                                                          | Required&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; | Default             |
| :----------------------------------------------------------------------------------------------------- | :---- | :----------------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------- | :------------------ |
| `--game`                                                                                               | `-g`  | Game title to search for                                                                                                             | Yes (or -u/-r)                                                             | -                   |
| `--platform`                                                                                           | `-p`  | Specific platform (e.g., "Xbox", "PS5"). Used in addition to `--game`.                                                               | No                                                                         | -                   |
| `--url`                                                                                                | `-u`  | Direct ESRB URL (e.g., https://www.esrb.org/ratings/...)                                                                             | Yes (or -g/-r)                                                             | -                   |
| `--rating`                                                                                             | `-r`  | Manual Rating Category. Valid values: `E`, `E10plus`, `T`, `M`, `AO`, `RP`                                                           | Yes (if no -g/-u)                                                          | -                   |
| `--descriptors`                                                                                        | `-d`  | Manual Content Descriptors (comma-separated)                                                                                         | No                                                                         | -                   |
| `--interactive`                                                                                        | `-i`  | Manual Interactive Elements (comma-separated)                                                                                        | No                                                                         | -                   |
| `--output`                                                                                             | `-o`  | Output file path. Extensions `.png`, `.jpg`, `.jpeg` supported. Defaults to `.png` if missing/invalid.                               | No                                                                         | `output/output.png` |
| `--margin`                                                                                             | `-m`  | Horizontal margin (white box indentation)                                                                                            | No                                                                         | `0` (Full Screen)   |
| `--aspect-ratio`                                                                                       | `-a`  | Content box aspect ratio. **Default `0` margin expands resolution (Variable Width).** Margin > 0 uses fixed 1920x1080 (Letterboxed). | No                                                                         | `auto`              |
| `--4k`                                                                                                 |       | Generate in 4K resolution (3840x2160)                                                                                                | No                                                                         | `false`             |
| `--force`                                                                                              |       | Ignore cache and force re-download of game data                                                                                      | No                                                                         | `false`             |

## Testing

Run the test suite using Jest:

```bash
npm test
```

## License

This project is released under the [MIT License](LICENSE).
