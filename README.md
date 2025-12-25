# 🎄 The Global Pixel Tree

A real-time collaborative pixel art Christmas tree where users from around the world can paint together!

![Demo](https://img.shields.io/badge/Status-Active-success)
![Rust](https://img.shields.io/badge/Backend-Rust-orange)
![React](https://img.shields.io/badge/Frontend-React-blue)

## ✨ Features

- **Real-time Collaboration**: See other users' paintings appear instantly (< 100ms latency)
- **High Concurrency**: Handles thousands of simultaneous users
- **Persistent State**: Artwork is auto-saved every minute
- **Cooldown System**: 5-second cooldown prevents spam
- **Tree Masking**: Can only paint within the Christmas tree shape
- **Beautiful UI**: Glassmorphism design with snowfall animation

## 🏗️ Architecture

```
[ Browser (React + Canvas) ]
           |
           | WebSocket
           v
[ Nginx (Reverse Proxy) ]
           |
           v
[ Rust Backend (Axum) ]
     |           |
     v           v
[ In-Memory ]  [ backup.json ]
```

## 📁 Project Structure

```
christmasTree/
├── backend/                 # Rust backend
│   ├── Cargo.toml
│   └── src/main.rs
├── frontend/                # React frontend
│   ├── package.json
│   ├── index.html
│   └── src/
│       ├── App.jsx
│       ├── index.css
│       └── components/
│           ├── GameCanvas.jsx
│           ├── Palette.jsx
│           └── Status.jsx
├── data/                    # Backup storage
│   └── backup.json
└── deploy/                  # Deployment configs
    ├── nginx.conf
    └── pixeltree.service
```

## 🚀 Quick Start (Development)

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- npm

### 1. Start the Backend

```bash
cd backend
cargo run --release
```

The server will start on `http://localhost:3000`

### 2. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on `http://localhost:5173`

### 3. Open in Browser

Navigate to `http://localhost:5173` and start painting! 🎨

## 🌐 Production Deployment (Ubuntu)

### 1. Install Dependencies

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install Nginx
sudo apt install -y nginx
```

### 2. Build the Project

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/christmasTree.git /home/user/pixel-tree
cd /home/user/pixel-tree

# Build backend
cd backend
cargo build --release

# Build frontend
cd ../frontend
npm install
npm run build
```

### 3. Configure Nginx

```bash
# Copy config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/pixeltree

# Edit and replace YOUR_DOMAIN_OR_IP
sudo nano /etc/nginx/sites-available/pixeltree

# Enable site
sudo ln -s /etc/nginx/sites-available/pixeltree /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Setup Systemd Service

```bash
# Copy service file
sudo cp deploy/pixeltree.service /etc/systemd/system/

# Start service
sudo systemctl daemon-reload
sudo systemctl enable pixeltree
sudo systemctl start pixeltree

# Check status
sudo systemctl status pixeltree
```

### 5. (Optional) Setup HTTPS with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 🔧 Configuration

### Backend Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | `info` | Log level (trace, debug, info, warn, error) |

### Constants (in `main.rs`)

| Constant | Value | Description |
|----------|-------|-------------|
| `GRID_WIDTH` | 100 | Canvas width in pixels |
| `GRID_HEIGHT` | 150 | Canvas height in pixels |
| `COOLDOWN_SECONDS` | 5 | Wait time between paintings |
| `BACKUP_INTERVAL_SECS` | 60 | Auto-save interval |

## 📡 WebSocket Protocol

### Client → Server

**Paint Request:**
```json
{
  "type": "PAINT",
  "payload": {
    "index": 4520,
    "color": "#FF0000"
  }
}
```

### Server → Client

**Initial State:**
```json
{
  "type": "INITIAL_STATE",
  "payload": {
    "grid": [{"color": "#1a1a2e"}, ...],
    "online_count": 42,
    "tree_mask": [false, false, ..., true, ...]
  }
}
```

**Pixel Update:**
```json
{
  "type": "UPDATE_PIXEL",
  "payload": {
    "index": 4520,
    "color": "#FF0000"
  }
}
```

**Online Count Update:**
```json
{
  "type": "UPDATE_COUNT",
  "payload": {
    "count": 43
  }
}
```

## 🎨 Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| 🔴 Christmas Red | `#C41E3A` | Ornaments |
| 🟢 Forest Green | `#228B22` | Tree |
| 🟡 Gold | `#FFD700` | Star, tinsel |
| ⚪ White | `#FFFFFF` | Snow, highlights |
| 🟤 Brown | `#8B4513` | Trunk |
| + 11 more | | Various decorations |

## 📊 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ws` | WebSocket | Main WebSocket endpoint |
| `/health` | GET | Health check (returns "OK") |
| `/stats` | GET | Server statistics (JSON) |

## 🛠️ Development

### Useful Commands

```bash
# Watch backend with auto-reload
cargo watch -x run

# Frontend development
npm run dev

# Build production frontend
npm run build

# View backend logs
sudo journalctl -u pixeltree -f
```

## 📝 License

MIT License - Feel free to use this for your own Christmas projects! 🎅

## 🙏 Credits

Built with ❤️ for the holiday season.

- **Backend**: Rust, Axum, Tokio
- **Frontend**: React, Vite, HTML5 Canvas
- **Deployment**: Nginx, Systemd