# Wiki Hub Quick Start

## Prerequisites

- Node.js 18+
- Python 3

## One-Click Start

### Windows

```powershell
cd F:\ZReadHub
powershell -ExecutionPolicy Bypass -File .\scripts\start-hub.ps1
```

### macOS / Linux

```bash
cd /path/to/ZReadHub
chmod +x ./scripts/start-hub.sh
./scripts/start-hub.sh
```

After startup:

- Site: `http://127.0.0.1:4173/hub/index.html`
- Admin API: `http://127.0.0.1:4174/health`

Press `Ctrl+C` to stop both services.

If ports are occupied by old processes, run stop script first.

### Windows Stop

```powershell
cd F:\ZReadHub
powershell -ExecutionPolicy Bypass -File .\scripts\stop-hub.ps1
```

### macOS / Linux Stop

```bash
cd /path/to/ZReadHub
chmod +x ./scripts/stop-hub.sh
./scripts/stop-hub.sh
```

## One-Click Package

### Windows

```powershell
cd F:\ZReadHub
powershell -ExecutionPolicy Bypass -File .\scripts\pack-hub.ps1
```

Output:

- `dist/wikihub-bundle.zip`

### macOS / Linux

```bash
cd /path/to/ZReadHub
chmod +x ./scripts/pack-hub.sh
./scripts/pack-hub.sh
```

Output:

- `dist/wikihub-bundle.zip`
- `dist/wikihub-bundle.tar.gz`

## Notes

- `导入本地Wiki路径` depends on local admin service (`:4174`), so always start with `start-hub` script.
- The package contains:
  - `hub/`
  - `hub-data/`
  - `scripts/`
  - `README-HUB.md`
  - `test-page.html`
