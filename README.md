# ESRB Rating Slate Generator

A Node.js-based tool for automatically generating broadcast-compliant ESRB Rating Slates. This application scrapes the official [ESRB website](https://www.esrb.org) for game data and renders a high-resolution PNG image suitable for video trailers.

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
    docker run --rm -v $(pwd):/output esrb-gen \
      --game "Borderlands 2" \
      --platform "PC" \
      --output "/output/result.png"
    ```

### Local Development

1.  **Install dependencies:**
    ```bash
    npm install
    ```
    *Note: You may need to install system libraries for `canvas` (e.g., `pkg-config`, `cairo`, `pango`) if the installation fails. See [node-canvas documentation](https://github.com/Automattic/node-canvas).*

2.  **Setup Assets:**
    Download the standard rating icons:
    ```bash
    npm run build # This runs the download script automatically
    # OR manual:
    npx ts-node scripts/download_assets.ts
    ```

3.  **Run the CLI:**
    ```bash
    npx ts-node src/index.ts -g "Borderlands 2" -o test.png
    ```

## CLI Options

| Option | Alias | Description | Required | Default |
| :--- | :--- | :--- | :--- | :--- |
| `--game` | `-g` | Game title to search for | Yes | - |
| `--platform` | `-p` | Specific platform (e.g., "Xbox", "PS5") | No | - |
| `--output` | `-o` | Output file path | No | `output.png` |

## Testing

Run the test suite using Jest:
```bash
npm test
```

## Project Structure

*   `src/services/ScraperService`: Handles parsing ESRB.org HTML.
*   `src/services/RenderService`: Handles drawing the slate using Canvas API.
*   `assets/icons`: Stores standard rating icons (SVG/PNG).
*   `assets/fonts`: (Optional) Custom fonts. System fonts are used as fallback.

## License

MIT
