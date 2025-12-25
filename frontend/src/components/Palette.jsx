function Palette({ colors, selectedColor, onSelectColor, disabled }) {
    return (
        <div className="palette">
            <div className="palette-title">Choose a Color</div>
            <div className="palette-colors">
                {colors.map((color) => (
                    <button
                        key={color}
                        className={`color-swatch ${selectedColor === color ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => !disabled && onSelectColor(color)}
                        disabled={disabled}
                        title={color}
                        aria-label={`Select color ${color}`}
                    />
                ))}
            </div>
        </div>
    );
}

export default Palette;
