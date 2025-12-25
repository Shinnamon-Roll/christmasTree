import { useState, useEffect, useRef, useCallback } from 'react';
import './index.css';
import GameCanvas from './components/GameCanvas';
import Palette from './components/Palette';
import Status from './components/Status';
import MessageInput from './components/MessageInput';
import FallingItems from './components/FallingItems';
import EmojiPalette from './components/EmojiPalette';

// Constants
const GRID_WIDTH = 100;
const GRID_HEIGHT = 150;

// Christmas color palette (16 colors)
const COLORS = [
  '#C41E3A', // Christmas Red
  '#FF6B6B', // Light Red
  '#228B22', // Forest Green
  '#32CD32', // Lime Green
  '#006400', // Dark Green
  '#90EE90', // Light Green
  '#FFD700', // Gold
  '#FFA500', // Orange
  '#FFFFFF', // White
  '#FFFAFA', // Snow White
  '#8B4513', // Brown (trunk)
  '#D2691E', // Chocolate
  '#87CEEB', // Sky Blue
  '#4169E1', // Royal Blue
  '#9400D3', // Purple
  '#1a1a2e', // Background (eraser)
];

function App() {
  // State
  const [grid, setGrid] = useState(null);
  const [treeMask, setTreeMask] = useState(null);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [onlineCount, setOnlineCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isLoading, setIsLoading] = useState(true);
  const [fallingItems, setFallingItems] = useState([]);
  const [isEmojiMode, setIsEmojiMode] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState('⭐');
  const [placedEmojis, setPlacedEmojis] = useState([]);
  const emojiIdRef = useRef(0);

  // Refs
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const itemIdRef = useRef(0);

  // Calculate WebSocket URL
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    // In development, connect directly to backend
    if (window.location.hostname === 'localhost' && window.location.port === '5173') {
      return 'ws://localhost:3000/ws';
    }
    return `${protocol}//${host}/ws`;
  }, []);

  // Add a falling item
  const addFallingItem = useCallback((item) => {
    const id = ++itemIdRef.current;
    setFallingItems(prev => [...prev, { ...item, id }]);

    // Remove item after animation completes (10 seconds)
    setTimeout(() => {
      setFallingItems(prev => prev.filter(i => i.id !== id));
    }, 10000);
  }, []);

  // WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('🎄 Connected to Pixel Tree server');
      setConnectionStatus('connected');
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    ws.onclose = () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
      // Attempt to reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  }, [getWsUrl]);

  // Handle messages from server
  const handleServerMessage = useCallback((message) => {
    switch (message.type) {
      case 'INITIAL_STATE':
        // Convert grid array to simple color array
        const colors = message.payload.grid.map(p => p.color);
        setGrid(colors);
        setTreeMask(message.payload.tree_mask);
        setOnlineCount(message.payload.online_count);
        setIsLoading(false);
        console.log('📦 Received initial state:', colors.length, 'pixels');
        break;

      case 'UPDATE_PIXEL':
        setGrid(prevGrid => {
          if (!prevGrid) return prevGrid;
          const newGrid = [...prevGrid];
          newGrid[message.payload.index] = message.payload.color;
          return newGrid;
        });
        break;

      case 'UPDATE_COUNT':
        setOnlineCount(message.payload.count);
        break;

      case 'FALLING_ITEM':
        addFallingItem({
          type: message.payload.item_type,
          content: message.payload.content,
          xPosition: message.payload.x_position,
        });
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  }, [addFallingItem]);

  // Send paint request (no cooldown - real-time!)
  const sendPaint = useCallback((index, color) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      console.log('Not connected');
      return false;
    }

    // Check tree mask
    if (treeMask && !treeMask[index]) {
      return false;
    }

    // Send paint request
    const message = {
      type: 'PAINT',
      payload: { index, color }
    };
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, [treeMask]);

  // Send message
  const sendMessage = useCallback((text) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message = {
      type: 'SEND_MESSAGE',
      payload: { text }
    };
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  // Send image
  const sendImage = useCallback((imageData) => {
    if (wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }

    const message = {
      type: 'SEND_IMAGE',
      payload: { data: imageData }
    };
    wsRef.current.send(JSON.stringify(message));
    return true;
  }, []);

  // Handle canvas click
  const handleCanvasClick = useCallback((x, y) => {
    if (!grid) return;

    const index = y * GRID_WIDTH + x;
    if (index >= 0 && index < GRID_WIDTH * GRID_HEIGHT) {
      // Check if pixel is in tree mask
      if (treeMask && !treeMask[index]) return;

      if (isEmojiMode) {
        // Place emoji
        const emojiId = ++emojiIdRef.current;
        setPlacedEmojis(prev => [...prev, {
          id: emojiId,
          emoji: selectedEmoji,
          x: x,
          y: y
        }]);
      } else {
        // Paint pixel
        sendPaint(index, selectedColor);
      }
    }
  }, [grid, treeMask, selectedColor, sendPaint, isEmojiMode, selectedEmoji]);

  // Toggle between paint and emoji mode
  const toggleEmojiMode = useCallback(() => {
    setIsEmojiMode(prev => !prev);
  }, []);

  // Connect on mount
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Generate snowflakes
  const snowflakes = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    animationDuration: `${5 + Math.random() * 10}s`,
    animationDelay: `${Math.random() * 5}s`,
    fontSize: `${0.5 + Math.random() * 1}rem`,
  }));

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <p className="loading-text">Connecting to the tree...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Snowflakes */}
      <div className="snowflakes">
        {snowflakes.map((flake) => (
          <div
            key={flake.id}
            className="snowflake"
            style={{
              left: flake.left,
              animationDuration: flake.animationDuration,
              animationDelay: flake.animationDelay,
              fontSize: flake.fontSize,
            }}
          >
            ❄
          </div>
        ))}
      </div>

      {/* Falling Items (messages & images) */}
      <FallingItems items={fallingItems} />

      {/* Connection Status */}
      <div className="connection-status">
        <div className={`connection-dot ${connectionStatus}`} />
        <span>
          {connectionStatus === 'connected' ? 'Connected' :
            connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
        </span>
      </div>

      {/* Header */}
      <header className="header">
        <h1>🎄 The Global Pixel Tree 🎄</h1>
        <p>Paint together with people around the world!</p>
      </header>

      {/* Canvas */}
      <div className="canvas-container">
        <GameCanvas
          grid={grid}
          treeMask={treeMask}
          width={GRID_WIDTH}
          height={GRID_HEIGHT}
          onPixelClick={handleCanvasClick}
          selectedColor={selectedColor}
          isEmojiMode={isEmojiMode}
          placedEmojis={placedEmojis}
          disabled={false}
        />
      </div>

      {/* Controls */}
      <div className="controls-panel">
        <Palette
          colors={COLORS}
          selectedColor={selectedColor}
          onSelectColor={setSelectedColor}
          disabled={isEmojiMode}
        />
        <EmojiPalette
          selectedEmoji={selectedEmoji}
          onSelectEmoji={setSelectedEmoji}
          isEmojiMode={isEmojiMode}
          onToggleMode={toggleEmojiMode}
          disabled={false}
        />
        <Status
          onlineCount={onlineCount}
        />
      </div>

      {/* Message Input */}
      <MessageInput
        onSendMessage={sendMessage}
        onSendImage={sendImage}
      />
    </div>
  );
}

export default App;
