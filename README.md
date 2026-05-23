# Web Comic / Manga Reader

Modern web-based comic and manga reader for CBR, CBZ, and CBT files with a custom fullscreen reader, library management, and reading progress tracking.

## Features

- **Custom Manga Reader** - Fullscreen reader built for manga: two-page spreads, right-to-left reading, page alignment bump
- **Two-Page Mode** - View spreads side-by-side, just like a physical book
- **Right-to-Left Mode** - Proper RTL layout for manga (right panel = lower page number)
- **Bump** - Shift spread alignment by one page to fix cover/double-page alignment
- **Keyboard Navigation** - Arrow keys to turn pages; Esc to close; all RTL-aware
- **Library Mode** - Select your comics folder once, access anytime with persistent folder access
- **Reading Progress** - Automatically saves and restores your last read page
- **Thumbnail Previews** - Auto-generated cover thumbnails for quick comic recognition
- **Recently Read** - Quick access to your last 5 comics with progress indicators
- **Quick Read Mode** - Upload and read individual files without library setup
- **Client-Side Only** - All processing happens in your browser, no server uploads required
- **Offline Support** - Works completely offline after initial load

## Reader Controls

| Action | How |
|--------|-----|
| Next page | Click right half of screen, or → key |
| Previous page | Click left half of screen, or ← key |
| Close reader | Click ✕, or Esc |
| Two-page mode | Click **2P** button |
| Right-to-left | Click **RTL** button (RTL flips the nav zones too) |
| Bump | Click **Bump** button (only active in 2P mode) — shifts spread alignment by 1 page |

The control bar auto-hides and reappears on mouse movement.

### Bump explained

In two-page mode, pages are paired as (0,1), (2,3), (4,5)... If a standalone cover page throws off spread alignment, toggle **Bump** to shift pairings to (1,2), (3,4), (5,6)... — the cover then stands alone and every subsequent spread lines up correctly.

## Usage

### Library Mode (Recommended)
1. Click "Select Comics Folder"
2. Choose your comics folder and grant permission
3. Browse your library with thumbnails and progress tracking
4. Click any comic to read
5. Your progress is automatically saved

### Quick Read Mode
1. Click "Quick Read"
2. Upload a single CBR/CBZ/CBT file
3. Read immediately (progress won't be saved)

## Getting Started

### Prerequisites
- A local web server (Python's `http.server`, Node's `http-server`, etc.)
- For Library Mode: HTTPS or localhost (Chrome allows File System Access API on localhost over HTTP)

### Setup
```bash
git clone <repository-url>
cd manga-reader

# Python 3
python3 -m http.server 8000

# Node.js
npx http-server -p 8000
```

Visit `http://localhost:8000`. Library Mode works on localhost over plain HTTP in Chrome.

### HTTPS Setup (for non-localhost Library Mode)

**Using mkcert:**
```bash
brew install mkcert       # macOS
mkcert -install
mkcert localhost 127.0.0.1
npx http-server -p 8000 -S -C localhost+1.pem -K localhost+1-key.pem
```

## File Structure

```
├── index.html              # Main HTML + reader overlay + reader CSS
├── assets/
│   ├── css/
│   │   └── styles.css     # Library UI styles and theming
│   └── js/
│       ├── script.js      # Application logic + custom reader
│       └── uncompress/
│           └── uncompress.js  # Archive extraction (Uncompress.js)
├── README.md
└── LICENSE
```

## Technical Notes

- Reading progress stored in `localStorage` (key: `comic_reader_userpref`)
- Folder handles stored in `IndexedDB` (database: `ComicReaderDB`)
- Thumbnails are base64-encoded JPEG stored in localStorage
- Archive entries are sorted by filename (natural sort) before display — pages always in correct order
- No external viewer dependency: lightGallery replaced with a custom reader

## Requirements

- Modern browser with File System Access API support (Chrome, Edge, Opera)
- HTTPS or localhost required for Library Mode

## Browser Compatibility

### Library Mode (File System Access API)
**✅ Fully Supported:**
- Chrome/Chromium (desktop)
- Microsoft Edge (desktop)
- Opera (desktop)

**❌ Not Supported:**
- Safari — Apple has not implemented this API
- Firefox — Partially supported behind flags, not production-ready
- All iOS browsers — inherit Safari's engine limitations

Safari and unsupported browsers fall back to Quick Read mode automatically.

## Supported Formats

- `.cbz` — Comic Book ZIP
- `.cbr` — Comic Book RAR
- `.cbt` — Comic Book TAR

## Credits

- [Uncompress.js](https://github.com/workhorsy/uncompress.js) — Archive extraction
- [Dropzone.js](https://www.dropzone.dev/) — File upload handling

## License

MIT — see LICENSE file for details.
