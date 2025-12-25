function FallingItems({ items }) {
    return (
        <div className="falling-items-container">
            {items.map((item) => (
                <div
                    key={item.id}
                    className={`falling-item falling-item-${item.type}`}
                    style={{
                        left: `${item.xPosition * 100}%`,
                        animationDelay: '0s',
                    }}
                >
                    {item.type === 'text' ? (
                        <div className="falling-text">
                            {item.content}
                        </div>
                    ) : (
                        <img
                            src={item.content}
                            alt="Falling"
                            className="falling-image"
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

export default FallingItems;
