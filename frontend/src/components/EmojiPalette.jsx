import { useState } from 'react';

const EMOJIS = ['⭐', '❤️', '🎁', '🔔', '✨', '🎀', '🎄', '❄️', '🎅', '⛄', '🦌', '🕯️'];

function EmojiPalette({ selectedEmoji, onSelectEmoji, isEmojiMode, onToggleMode, disabled }) {
    return (
        <div className="emoji-palette">
            <div className="palette-header">
                <span className="palette-title">DECORATIONS</span>
                <button
                    className={`mode-toggle ${isEmojiMode ? 'active' : ''}`}
                    onClick={onToggleMode}
                    disabled={disabled}
                >
                    {isEmojiMode ? '🎨 Switch to Paint' : '✨ Place Emojis'}
                </button>
            </div>

            {isEmojiMode && (
                <div className="emoji-grid">
                    {EMOJIS.map((emoji) => (
                        <button
                            key={emoji}
                            className={`emoji-swatch ${selectedEmoji === emoji ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                            onClick={() => onSelectEmoji(emoji)}
                            disabled={disabled}
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export default EmojiPalette;
