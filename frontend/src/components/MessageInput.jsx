import { useState, useRef } from 'react';

function MessageInput({ onSendMessage, onSendImage }) {
    const [text, setText] = useState('');
    const [imagePreview, setImagePreview] = useState(null);
    const fileInputRef = useRef(null);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (imagePreview) {
            onSendImage(imagePreview);
            setImagePreview(null);
        } else if (text.trim()) {
            onSendMessage(text.trim());
            setText('');
        }
    };

    const handleImageSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Check file size (max 100KB)
        if (file.size > 100 * 1024) {
            alert('รูปภาพต้องมีขนาดไม่เกิน 100KB');
            return;
        }

        // Check file type
        if (!file.type.startsWith('image/')) {
            alert('กรุณาเลือกไฟล์รูปภาพ');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            setImagePreview(event.target.result);
            setText(''); // Clear text when image is selected
        };
        reader.readAsDataURL(file);
    };

    const clearImage = () => {
        setImagePreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="message-input-container">
            <form onSubmit={handleSubmit} className="message-form">
                {imagePreview ? (
                    <div className="image-preview-wrapper">
                        <img src={imagePreview} alt="Preview" className="image-preview" />
                        <button
                            type="button"
                            className="clear-image-btn"
                            onClick={clearImage}
                            aria-label="Remove image"
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <input
                        type="text"
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="พิมพ์ข้อความ... (ไม่เกิน 50 ตัวอักษร)"
                        maxLength={50}
                        className="message-text-input"
                    />
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden-file-input"
                    id="image-upload"
                />

                <label htmlFor="image-upload" className="upload-btn" title="อัปโหลดรูปภาพ">
                    📷
                </label>

                <button
                    type="submit"
                    className="send-btn"
                    disabled={!text.trim() && !imagePreview}
                >
                    ส่ง ✨
                </button>
            </form>

            <p className="input-hint">
                {imagePreview ? 'คลิก "ส่ง" เพื่อส่งรูปภาพ' : 'ข้อความและรูปภาพจะลอยร่วงลงมาบนหน้าจอทุกคน!'}
            </p>
        </div>
    );
}

export default MessageInput;
