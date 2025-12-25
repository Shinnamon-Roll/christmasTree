import { useRef, useEffect, useCallback } from 'react';

// Canvas scale factor for display
const PIXEL_SIZE = 4;

function GameCanvas({ grid, treeMask, width, height, onPixelClick, selectedColor, isEmojiMode, placedEmojis = [], disabled }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const isPaintingRef = useRef(false);
    const lastPaintedPixelRef = useRef(null);
    const gridRef = useRef(grid);

    // Keep grid ref updated
    useEffect(() => {
        gridRef.current = grid;
    }, [grid]);

    // Draw the entire grid
    const drawGrid = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !grid) return;

        const ctx = canvas.getContext('2d');

        // Draw each pixel
        for (let i = 0; i < grid.length; i++) {
            const x = i % width;
            const y = Math.floor(i / width);

            ctx.fillStyle = grid[i];
            ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
        }

        // Draw tree outline for guidance (subtle)
        if (treeMask) {
            ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
            ctx.lineWidth = 1;

            for (let i = 0; i < treeMask.length; i++) {
                if (treeMask[i]) {
                    const x = i % width;
                    const y = Math.floor(i / width);

                    // Check if this is an edge pixel
                    const isEdge = (
                        !treeMask[i - 1] || // left
                        !treeMask[i + 1] || // right
                        !treeMask[i - width] || // top
                        !treeMask[i + width] // bottom
                    );

                    if (isEdge) {
                        ctx.strokeRect(
                            x * PIXEL_SIZE + 0.5,
                            y * PIXEL_SIZE + 0.5,
                            PIXEL_SIZE - 1,
                            PIXEL_SIZE - 1
                        );
                    }
                }
            }
        }
    }, [grid, treeMask, width]);

    // Draw a single pixel immediately (optimistic update)
    const drawPixelImmediate = useCallback((pixelX, pixelY, color) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(pixelX * PIXEL_SIZE, pixelY * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }, []);

    // Initial draw when grid loads
    useEffect(() => {
        drawGrid();
    }, [drawGrid]);

    // Get pixel coordinates from mouse event
    const getPixelFromEvent = useCallback((event) => {
        const canvas = canvasRef.current;
        if (!canvas) return null;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;

        const pixelX = Math.floor(canvasX / PIXEL_SIZE);
        const pixelY = Math.floor(canvasY / PIXEL_SIZE);

        if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
            return { pixelX, pixelY, index: pixelY * width + pixelX };
        }
        return null;
    }, [width, height]);

    // Paint a pixel (with optimistic update)
    const paintPixel = useCallback((pixelX, pixelY, index) => {
        // Check tree mask
        if (treeMask && !treeMask[index]) {
            return false;
        }

        // Skip if same pixel was just painted
        if (lastPaintedPixelRef.current === index) {
            return false;
        }
        lastPaintedPixelRef.current = index;

        // Draw immediately on canvas (optimistic update - no flicker!)
        drawPixelImmediate(pixelX, pixelY, selectedColor);

        // Send to server
        onPixelClick(pixelX, pixelY);
        return true;
    }, [treeMask, selectedColor, drawPixelImmediate, onPixelClick]);

    // Handle mouse down - start painting
    const handleMouseDown = useCallback((event) => {
        if (disabled) return;

        isPaintingRef.current = true;
        lastPaintedPixelRef.current = null;

        const pixel = getPixelFromEvent(event);
        if (pixel) {
            paintPixel(pixel.pixelX, pixel.pixelY, pixel.index);
        }
    }, [disabled, getPixelFromEvent, paintPixel]);

    // Handle mouse move - continue painting if dragging
    const handleMouseMove = useCallback((event) => {
        if (disabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const pixel = getPixelFromEvent(event);
        if (!pixel) return;

        // Update cursor based on tree mask
        if (treeMask && !treeMask[pixel.index]) {
            canvas.style.cursor = 'not-allowed';
        } else {
            canvas.style.cursor = 'crosshair';
        }

        // If painting (mouse held down), paint this pixel
        if (isPaintingRef.current) {
            paintPixel(pixel.pixelX, pixel.pixelY, pixel.index);
        }
    }, [disabled, getPixelFromEvent, treeMask, paintPixel]);

    // Handle mouse up - stop painting
    const handleMouseUp = useCallback(() => {
        isPaintingRef.current = false;
        lastPaintedPixelRef.current = null;
    }, []);

    // Handle mouse leave - stop painting
    const handleMouseLeave = useCallback(() => {
        isPaintingRef.current = false;
        lastPaintedPixelRef.current = null;
    }, []);

    const canvasWidth = width * PIXEL_SIZE;
    const canvasHeight = height * PIXEL_SIZE;

    // Calculate emoji position based on canvas scaling
    const getEmojiPosition = useCallback((x, y) => {
        const canvas = canvasRef.current;
        if (!canvas) return { left: 0, top: 0 };

        const rect = canvas.getBoundingClientRect();
        const scaleX = rect.width / canvas.width;
        const scaleY = rect.height / canvas.height;

        return {
            left: (x * PIXEL_SIZE + PIXEL_SIZE / 2) * scaleX,
            top: (y * PIXEL_SIZE + PIXEL_SIZE / 2) * scaleY
        };
    }, []);

    return (
        <div ref={containerRef} className="canvas-wrapper">
            <canvas
                ref={canvasRef}
                className={`game-canvas ${disabled ? 'disabled' : ''} ${isEmojiMode ? 'emoji-mode' : ''}`}
                width={canvasWidth}
                height={canvasHeight}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
                style={{
                    maxWidth: '100%',
                    height: 'auto',
                }}
            />
            {/* Emoji Overlay */}
            {placedEmojis.length > 0 && (
                <div className="emoji-overlay">
                    {placedEmojis.map((emoji) => {
                        const pos = getEmojiPosition(emoji.x, emoji.y);
                        return (
                            <span
                                key={emoji.id}
                                className="placed-emoji"
                                style={{
                                    left: pos.left,
                                    top: pos.top
                                }}
                            >
                                {emoji.emoji}
                            </span>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

export default GameCanvas;
