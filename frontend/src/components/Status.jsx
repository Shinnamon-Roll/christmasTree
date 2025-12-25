function Status({ onlineCount, onResetTree, onClearFallingItems }) {
    return (
        <div className="status">
            {/* Online Count */}
            <div className="status-item">
                <div className="online-dot" />
                <div>
                    <div className="status-label">Online Now</div>
                    <div className="status-value online">{onlineCount.toLocaleString()}</div>
                </div>
            </div>

            {/* Paint Status - Always Ready */}
            <div className="status-item">
                <div>
                    <div className="status-label">Paint Status</div>
                    <div className="status-value ready">✓ Real-time!</div>
                </div>
            </div>

            {/* Reset Tree Button */}
            {onResetTree && (
                <button
                    className="reset-tree-btn"
                    onClick={onResetTree}
                    title="Reset the tree to default colors"
                >
                    🗑️ Reset Tree
                </button>
            )}

            {/* Clear Falling Items Button */}
            {onClearFallingItems && (
                <button
                    className="clear-items-btn"
                    onClick={onClearFallingItems}
                    title="Clear all falling messages and images"
                >
                    ✖️ ลบข้อความ/รูป
                </button>
            )}
        </div>
    );
}

export default Status;
