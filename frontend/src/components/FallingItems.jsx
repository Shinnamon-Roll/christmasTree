import { useState, useEffect, useRef } from 'react';

const MAX_FALLING_ITEMS = 20;
const FALL_DURATION = 12000; // 12 seconds to fall

function FallingItems({ items, onItemComplete }) {
    const [activeItems, setActiveItems] = useState([]);
    const itemsRef = useRef([]);
    const animationKeyRef = useRef(0);

    // When new items come from server, add them to our loop
    useEffect(() => {
        if (items.length === 0) return;

        // Get the newest item
        const newItems = items.filter(item =>
            !itemsRef.current.some(existing => existing.originalId === item.id)
        );

        if (newItems.length > 0) {
            const newActiveItems = newItems.map(item => ({
                ...item,
                originalId: item.id,
                animKey: ++animationKeyRef.current,
                xPosition: item.xPosition, // Initial position
            }));

            itemsRef.current = [...itemsRef.current, ...newActiveItems].slice(-MAX_FALLING_ITEMS);
            setActiveItems([...itemsRef.current]);
        }
    }, [items]);

    // Handle animation end - restart with new random position
    const handleAnimationEnd = (item) => {
        // Generate new random position and restart
        const newXPosition = Math.random();
        const updatedItems = itemsRef.current.map(i => {
            if (i.animKey === item.animKey) {
                return {
                    ...i,
                    animKey: ++animationKeyRef.current,
                    xPosition: newXPosition,
                };
            }
            return i;
        });

        itemsRef.current = updatedItems;
        setActiveItems([...updatedItems]);
    };

    return (
        <div className="falling-items-container">
            {activeItems.map((item) => (
                <div
                    key={item.animKey}
                    className={`falling-item falling-item-${item.type}`}
                    style={{
                        left: `${item.xPosition * 100}%`,
                    }}
                    onAnimationEnd={() => handleAnimationEnd(item)}
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
