import { useRef, useEffect, useCallback } from 'react';

// Canvas scale factor for display
const PIXEL_SIZE = 4;

function GameCanvas({ grid, treeMask, width, height, onPixelClick, disabled }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

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

    // Draw a single updated pixel (optimized)
    const drawPixel = useCallback((index, color) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const x = index % width;
        const y = Math.floor(index / width);

        ctx.fillStyle = color;
        ctx.fillRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }, [width]);

    // Initial draw when grid loads
    useEffect(() => {
        drawGrid();
    }, [drawGrid]);

    // Handle canvas click
    const handleClick = useCallback((event) => {
        if (disabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;

        const pixelX = Math.floor(canvasX / PIXEL_SIZE);
        const pixelY = Math.floor(canvasY / PIXEL_SIZE);

        // Validate bounds
        if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
            const index = pixelY * width + pixelX;

            // Check tree mask
            if (treeMask && !treeMask[index]) {
                return; // Outside tree, ignore click
            }

            onPixelClick(pixelX, pixelY);
        }
    }, [disabled, width, height, treeMask, onPixelClick]);

    // Handle hover preview
    const handleMouseMove = useCallback((event) => {
        if (disabled) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const canvasX = (event.clientX - rect.left) * scaleX;
        const canvasY = (event.clientY - rect.top) * scaleY;

        const pixelX = Math.floor(canvasX / PIXEL_SIZE);
        const pixelY = Math.floor(canvasY / PIXEL_SIZE);

        if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
            const index = pixelY * width + pixelX;

            // Change cursor based on whether pixel is in tree
            if (treeMask && !treeMask[index]) {
                canvas.style.cursor = 'not-allowed';
            } else {
                canvas.style.cursor = 'crosshair';
            }
        }
    }, [disabled, width, height, treeMask]);

    const canvasWidth = width * PIXEL_SIZE;
    const canvasHeight = height * PIXEL_SIZE;

    return (
        <div ref={containerRef} className="canvas-wrapper">
            <canvas
                ref={canvasRef}
                className={`game-canvas ${disabled ? 'disabled' : ''}`}
                width={canvasWidth}
                height={canvasHeight}
                onClick={handleClick}
                onMouseMove={handleMouseMove}
                style={{
                    maxWidth: '100%',
                    height: 'auto',
                }}
            />
        </div>
    );
}

export default GameCanvas;
