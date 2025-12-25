//! The Global Pixel Tree - Real-time Collaborative Pixel Art Backend
//! 
//! This server handles WebSocket connections for a collaborative Christmas tree
//! pixel art canvas where users worldwide can paint together in real-time.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        ConnectInfo, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::get,
    Router,
};
use futures::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    net::SocketAddr,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};
use tokio::sync::{broadcast, RwLock};
use tower_http::cors::{Any, CorsLayer};
use tracing::{info, warn, error};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// ============================================================================
// CONSTANTS
// ============================================================================

/// Grid dimensions
const GRID_WIDTH: usize = 120;
const GRID_HEIGHT: usize = 180;
const GRID_SIZE: usize = GRID_WIDTH * GRID_HEIGHT; // 21,600 pixels

/// Cooldown time in seconds
const COOLDOWN_SECONDS: u64 = 5;

/// Backup interval in seconds
const BACKUP_INTERVAL_SECS: u64 = 60;

/// Default pixel color (transparent/empty)
const DEFAULT_COLOR: &str = "#1a1a2e";

/// Broadcast channel capacity
const BROADCAST_CAPACITY: usize = 1024;

/// Backup file path
const BACKUP_FILE: &str = "../data/backup.json";

// ============================================================================
// DATA STRUCTURES
// ============================================================================

/// A single pixel on the canvas
#[derive(Clone, Debug, Serialize, Deserialize)]
struct Pixel {
    color: String,
    last_updated: u64,
    modifier_id: String,
}

impl Default for Pixel {
    fn default() -> Self {
        Pixel {
            color: DEFAULT_COLOR.to_string(),
            last_updated: 0,
            modifier_id: String::new(),
        }
    }
}

/// The main application state
struct AppState {
    /// 1D vector representing the 2D grid (y * WIDTH + x)
    grid: Vec<Pixel>,
    /// Map of user IDs to their last paint timestamp (for cooldown)
    user_cooldowns: HashMap<String, u64>,
    /// Current number of connected users
    online_count: usize,
    /// Tree shape mask (true = paintable area)
    tree_mask: Vec<bool>,
}

impl AppState {
    fn new() -> Self {
        let grid = vec![Pixel::default(); GRID_SIZE];
        let tree_mask = generate_tree_mask();
        
        AppState {
            grid,
            user_cooldowns: HashMap::new(),
            online_count: 0,
            tree_mask,
        }
    }
    
    /// Load state from backup file if it exists
    fn load_from_backup() -> Self {
        let mut state = Self::new();
        
        if let Ok(data) = std::fs::read_to_string(BACKUP_FILE) {
            if let Ok(grid) = serde_json::from_str::<Vec<Pixel>>(&data) {
                if grid.len() == GRID_SIZE {
                    state.grid = grid;
                    info!("Loaded grid state from backup file");
                }
            }
        }
        
        state
    }
}

/// Shared state type
type SharedState = Arc<RwLock<AppState>>;

/// Combined application context for Axum state
#[derive(Clone)]
struct AppContext {
    state: SharedState,
    tx: broadcast::Sender<ServerMessage>,
}

// ============================================================================
// WEBSOCKET MESSAGE TYPES
// ============================================================================

/// Incoming message from client
#[derive(Debug, Deserialize)]
#[serde(tag = "type", content = "payload")]
enum ClientMessage {
    #[serde(rename = "PAINT")]
    Paint { index: usize, color: String },
    #[serde(rename = "SEND_MESSAGE")]
    SendMessage { text: String },
    #[serde(rename = "SEND_IMAGE")]
    SendImage { data: String },
}

/// Outgoing message to client
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", content = "payload")]
enum ServerMessage {
    #[serde(rename = "INITIAL_STATE")]
    InitialState { 
        grid: Vec<PixelData>,
        online_count: usize,
        tree_mask: Vec<bool>,
    },
    #[serde(rename = "UPDATE_PIXEL")]
    UpdatePixel { index: usize, color: String },
    #[serde(rename = "UPDATE_COUNT")]
    UpdateCount { count: usize },
    #[serde(rename = "FALLING_ITEM")]
    FallingItem { 
        item_type: String,  // "text" or "image"
        content: String,    // text content or base64 image
        x_position: f32,    // 0.0 - 1.0 random position
    },
}

/// Simplified pixel data for initial state
#[derive(Debug, Clone, Serialize)]
struct PixelData {
    color: String,
}

// ============================================================================
// TREE SHAPE MASK GENERATION
// ============================================================================

/// Generate the Christmas tree shape mask
/// Returns a boolean vector where true = paintable area
fn generate_tree_mask() -> Vec<bool> {
    let mut mask = vec![false; GRID_SIZE];
    
    // Tree parameters (scaled for 120x180 grid)
    let tree_top = 12;           // Y position of tree top
    let tree_bottom = 156;       // Y position of tree bottom
    let trunk_top = 156;         // Y position where trunk starts
    let trunk_bottom = 174;      // Y position of trunk bottom
    let center_x = GRID_WIDTH / 2;
    
    // Draw the triangular tree body with a slight width variation for layers
    for y in tree_top..=tree_bottom {
        // Create a layered effect with 3 overlapping triangles
        let progress = (y - tree_top) as f32 / (tree_bottom - tree_top) as f32;
        
        // Base triangle width (scaled for 120 width)
        let base_half_width = (progress * 50.0) as usize;
        
        // Add some waviness for a more natural look
        let layer_offset = if y % 20 < 5 { 2 } else { 0 };
        let half_width = (base_half_width + layer_offset).min(55);
        
        let left = center_x.saturating_sub(half_width);
        let right = (center_x + half_width).min(GRID_WIDTH - 1);
        
        for x in left..=right {
            let index = y * GRID_WIDTH + x;
            if index < GRID_SIZE {
                mask[index] = true;
            }
        }
    }
    
    // Draw the trunk
    let trunk_half_width = 8;
    for y in trunk_top..=trunk_bottom {
        let left = center_x.saturating_sub(trunk_half_width);
        let right = (center_x + trunk_half_width).min(GRID_WIDTH - 1);
        
        for x in left..=right {
            let index = y * GRID_WIDTH + x;
            if index < GRID_SIZE {
                mask[index] = true;
            }
        }
    }
    
    // Add a star at the top
    let star_y = tree_top - 3;
    for dy in -2i32..=2 {
        for dx in -2i32..=2 {
            let y = (star_y as i32 + dy) as usize;
            let x = (center_x as i32 + dx) as usize;
            if y < GRID_HEIGHT && x < GRID_WIDTH {
                // Create a star shape
                if dx.abs() + dy.abs() <= 2 {
                    let index = y * GRID_WIDTH + x;
                    if index < GRID_SIZE {
                        mask[index] = true;
                    }
                }
            }
        }
    }
    
    mask
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/// Get current Unix timestamp
fn current_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

/// Hash IP address to create user ID
fn hash_ip(addr: &SocketAddr) -> String {
    use std::hash::{Hash, Hasher};
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    addr.ip().hash(&mut hasher);
    format!("{:x}", hasher.finish())[..8].to_string()
}

/// Validate hex color format
fn is_valid_hex_color(color: &str) -> bool {
    if color.len() != 7 || !color.starts_with('#') {
        return false;
    }
    color[1..].chars().all(|c| c.is_ascii_hexdigit())
}

// ============================================================================
// WEBSOCKET HANDLER
// ============================================================================

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(ctx): State<AppContext>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> impl IntoResponse {
    let user_id = hash_ip(&addr);
    info!("New WebSocket connection from {}", addr);
    ws.on_upgrade(move |socket| handle_socket(socket, ctx.state, ctx.tx, user_id))
}

async fn handle_socket(
    socket: WebSocket,
    state: SharedState,
    tx: broadcast::Sender<ServerMessage>,
    user_id: String,
) {
    let (mut sender, mut receiver) = socket.split();
    
    // Increment online count
    {
        let mut state = state.write().await;
        state.online_count += 1;
        let count = state.online_count;
        let _ = tx.send(ServerMessage::UpdateCount { count });
        info!("User {} connected. Online: {}", user_id, count);
    }
    
    // Send initial state
    {
        let state = state.read().await;
        let grid: Vec<PixelData> = state.grid.iter()
            .map(|p| PixelData { color: p.color.clone() })
            .collect();
        
        let initial_msg = ServerMessage::InitialState {
            grid,
            online_count: state.online_count,
            tree_mask: state.tree_mask.clone(),
        };
        
        if let Ok(json) = serde_json::to_string(&initial_msg) {
            if sender.send(Message::Text(json)).await.is_err() {
                return;
            }
        }
    }
    
    // Subscribe to broadcast channel
    let mut rx = tx.subscribe();
    
    // Clone user_id for the receive task
    let user_id_clone = user_id.clone();
    let state_clone = state.clone();
    let tx_clone = tx.clone();
    
    // Spawn task to forward broadcast messages to this client
    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json)).await.is_err() {
                    break;
                }
            }
        }
    });
    
    // Handle incoming messages from this client
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if let Message::Text(text) = msg {
                if let Ok(client_msg) = serde_json::from_str::<ClientMessage>(&text) {
                    handle_client_message(
                        client_msg,
                        &state_clone,
                        &tx_clone,
                        &user_id_clone,
                    ).await;
                }
            }
        }
    });
    
    // Wait for either task to finish
    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    }
    
    // Decrement online count
    {
        let mut state = state.write().await;
        state.online_count = state.online_count.saturating_sub(1);
        let count = state.online_count;
        let _ = tx.send(ServerMessage::UpdateCount { count });
        info!("User {} disconnected. Online: {}", user_id, count);
    }
}

async fn handle_client_message(
    msg: ClientMessage,
    state: &SharedState,
    tx: &broadcast::Sender<ServerMessage>,
    user_id: &str,
) {
    match msg {
        ClientMessage::Paint { index, color } => {
            let now = current_timestamp();
            
            // Validate inputs
            if index >= GRID_SIZE {
                warn!("Invalid index {} from user {}", index, user_id);
                return;
            }
            
            if !is_valid_hex_color(&color) {
                warn!("Invalid color {} from user {}", color, user_id);
                return;
            }
            
            let mut state = state.write().await;
            
            // Check tree mask
            if !state.tree_mask[index] {
                // Position is outside the tree - silently ignore
                return;
            }
            
            // Update the pixel (NO COOLDOWN - real-time!)
            state.grid[index] = Pixel {
                color: color.clone(),
                last_updated: now,
                modifier_id: user_id.to_string(),
            };
            
            // Broadcast the update
            let _ = tx.send(ServerMessage::UpdatePixel { index, color });
        }
        
        ClientMessage::SendMessage { text } => {
            // Limit text length to 50 characters
            let text = if text.chars().count() > 50 {
                text.chars().take(50).collect()
            } else {
                text
            };
            
            if text.trim().is_empty() {
                return;
            }
            
            // Generate random x position (0.0 - 1.0)
            let x_position = (user_id.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32)) as f32 
                + current_timestamp() as f32) % 100.0 / 100.0;
            
            info!("User {} sent message: {}", user_id, text);
            
            // Broadcast falling text
            let _ = tx.send(ServerMessage::FallingItem {
                item_type: "text".to_string(),
                content: text,
                x_position,
            });
        }
        
        ClientMessage::SendImage { data } => {
            // No size limit - accept any image
            
            // Basic validation - should start with data URI prefix
            if !data.starts_with("data:image/") {
                warn!("Invalid image data from user {}", user_id);
                return;
            }
            
            // Generate random x position
            let x_position = (user_id.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32)) as f32 
                + current_timestamp() as f32) % 100.0 / 100.0;
            
            info!("User {} sent an image", user_id);
            
            // Broadcast falling image
            let _ = tx.send(ServerMessage::FallingItem {
                item_type: "image".to_string(),
                content: data,
                x_position,
            });
        }
    }
}

// ============================================================================
// BACKUP SYSTEM
// ============================================================================

async fn backup_task(state: SharedState) {
    loop {
        tokio::time::sleep(tokio::time::Duration::from_secs(BACKUP_INTERVAL_SECS)).await;
        
        let grid = {
            let state = state.read().await;
            state.grid.clone()
        };
        
        match serde_json::to_string(&grid) {
            Ok(json) => {
                if let Err(e) = std::fs::write(BACKUP_FILE, json) {
                    error!("Failed to write backup: {}", e);
                } else {
                    info!("Grid state backed up successfully");
                }
            }
            Err(e) => {
                error!("Failed to serialize grid: {}", e);
            }
        }
    }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

async fn health_check() -> impl IntoResponse {
    (StatusCode::OK, "OK")
}

async fn get_stats(State(ctx): State<AppContext>) -> impl IntoResponse {
    let state = ctx.state.read().await;
    let stats = serde_json::json!({
        "online_count": state.online_count,
        "grid_size": GRID_SIZE,
        "grid_width": GRID_WIDTH,
        "grid_height": GRID_HEIGHT,
    });
    (StatusCode::OK, axum::Json(stats))
}

// ============================================================================
// MAIN
// ============================================================================

#[tokio::main]
async fn main() {
    // Initialize logging
    tracing_subscriber::registry()
        .with(tracing_subscriber::fmt::layer())
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info".to_string()),
        ))
        .init();
    
    info!("🎄 The Global Pixel Tree Backend Starting...");
    info!("Grid size: {}x{} = {} pixels", GRID_WIDTH, GRID_HEIGHT, GRID_SIZE);
    
    // Initialize state (load from backup if available)
    let state: SharedState = Arc::new(RwLock::new(AppState::load_from_backup()));
    
    // Create broadcast channel
    let (tx, _rx) = broadcast::channel::<ServerMessage>(BROADCAST_CAPACITY);
    
    // Create application context
    let ctx = AppContext {
        state: state.clone(),
        tx,
    };
    
    // Start backup task
    let backup_state = state.clone();
    tokio::spawn(backup_task(backup_state));
    
    // Configure CORS
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    
    // Build router
    let app = Router::new()
        .route("/ws", get(ws_handler))
        .route("/health", get(health_check))
        .route("/stats", get(get_stats))
        .layer(cors)
        .with_state(ctx);
    
    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    info!("🚀 Server listening on {}", addr);
    
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .unwrap();
}
