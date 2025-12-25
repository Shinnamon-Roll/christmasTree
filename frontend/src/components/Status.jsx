function Status({ onlineCount }) {
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
        </div>
    );
}

export default Status;
