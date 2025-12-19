# ESRB Rating Slate Generator

A Node.js-based tool for automatically generating broadcast-compliant ESRB Rating Slates. This application scrapes the official [ESRB website](https://www.esrb.org) for game data and renders a high-resolution PNG image suitable for video trailers.

<img src="esrb-slate-example.png" alt="ESRB Slate Example" width="640" />

_Example generation for [Borderlands 4](https://www.esrb.org/ratings/40649/borderlands-4/)_

[![CI](https://github.com/artryazanov/esrb-slate-gen/actions/workflows/ci.yml/badge.svg)](https://github.com/artryazanov/esrb-slate-gen/actions/workflows/ci.yml)
[![License: Unlicense](https://img.shields.io/badge/license-Unlicense-blue.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=flat&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/node.js-6DA55F?style=flat&logo=node.js&logoColor=white)
![Jest](https://img.shields.io/badge/-jest-%23C21325?style=flat&logo=jest&logoColor=white)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat)](https://github.com/prettier/prettier)

## Features

*   **Automated Scraping:** Fetches rating category and content descriptors directly from ESRB.org.
*   **Platform Filtering:** Optional filtering to target specific game versions (e.g., PS5 vs Xbox).
*   **High-Quality Rendering:** Generates 1920x1080 (Full HD) images with correct layout and standard icons.
*   **Docker Support:** Fully containerized environment ensuring consistent font and graphics rendering.
*   **TypeScript:** Type-safe codebase.

## Prerequisites

*   **Docker** (Recommended)
*   *OR* **Node.js v18+** with system dependencies for `node-canvas` (libcairo, libpango) installed.

## Usage

### Using Docker (Recommended)
1.  **Build the image:**
    ```bash
    docker build -t esrb-gen .
    ```

2.  **Run the generator:**
    Mount the current directory to `/output` inside the container to save the file locally.
    ```bash
    docker run --rm -v $(pwd)/output:/output esrb-gen \
      --game "Borderlands 2" \
      --platform "PC" \
      --output "/output/my-slate.png"
    ```

### Local Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```
    *Note: You may need to install system libraries for `canvas` (e.g., `pkg-config`, `cairo`, `pango`) if the installation fails. See [node-canvas documentation](https://github.com/Automattic/node-canvas).*

2.  **Setup Assets:**
    Download the standard rating icons and required font:
    ```bash
    npm run build # This runs the download script automatically
    # OR manual:
    npx ts-node scripts/download_assets.ts
    ```

3.  **Run the CLI:**
    ```bash
    npx ts-node src/index.ts -g "Borderlands 2"
    ```
    *This will save the image to `output/output.png` by default.*

    **Manual Generation (No Scraping):**
    ```bash
    npx ts-node src/index.ts -r "M" -d "Blood, Violence" -i "In-Game Purchases"
    ```

## CLI Options

| Option | Alias | Description | Required | Default |
| :--- | :--- | :--- | :--- | :--- |
| `--game` | `-g` | Game title to search for | Yes (or --url/--rating) | - |
| `--url` | `-u` | Direct ESRB URL (e.g., https://www.esrb.org/ratings/...) | Yes (or --game/--rating) | - |
| `--rating` | `-r` | Manual Rating Category. Valid values: `E`, `E10plus`, `T`, `M`, `AO`, `RP` | Yes (if no game/url) | - |
| `--descriptors` | `-d` | Manual Content Descriptors (comma-separated) | No | - |
| `--interactive` | `-i` | Manual Interactive Elements (comma-separated) | No | - |
| `--platform` | `-p` | Specific platform (e.g., "Xbox", "PS5") | No | - |
| `--output` | `-o` | Output file path. Extensions `.png`, `.jpg`, `.jpeg` supported. Defaults to `.png` if missing/invalid. | No | `output/output.png` |
| `--margin` | `-m` | Horizontal margin (white box indentation) | No | `0` (Full Screen) |
| `--aspect-ratio` | `-a` | Content box aspect ratio. **Default `0` margin expands resolution (Variable Width).** Margin > 0 uses fixed 1920x1080 (Letterboxed). | No | `auto` |
| `--4k` | | Generate in 4K resolution (3840x2160) | No | `false` |

## Testing

Run the test suite using Jest:
```bash
npm test
```

## Project Structure

*   `src/services/ScraperService`: Handles parsing ESRB.org HTML.
*   `src/services/RenderService`: Handles drawing the slate using Canvas API.
*   `assets/icons`: Stores standard rating icons (SVG/PNG).
*   `assets/fonts`: Stores the custom font (Arimo) used for rendering.

## License

This project is released under the [Unlicense](LICENSE).
