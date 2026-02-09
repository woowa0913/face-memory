import React, { useState, useRef, useEffect } from 'react';

interface FaceBoxOverlayProps {
    imageSrc: string;
    faces: { id?: string; box_2d: [number, number, number, number] }[]; // [ymin, xmin, ymax, xmax] 0-1000
    selectedFaceIndex: number | null;
    onSelectFace: (index: number | null) => void;
    onUpdateFace: (index: number, newBox: [number, number, number, number]) => void;
    onAddFace: (newBox: [number, number, number, number]) => void;
    onDeleteFace: (index: number) => void;
}

export const FaceBoxOverlay: React.FC<FaceBoxOverlayProps> = ({
    imageSrc,
    faces,
    selectedFaceIndex,
    onSelectFace,
    onUpdateFace,
    onAddFace,
    onDeleteFace,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br'
    const [isCreating, setIsCreating] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null); // For creation only

    const getMousePos = (e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current || !imgRef.current) return { x: 0, y: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Normalize to 0-1000 based on image natural size is NOT needed here for display
        // But we need to convert display px to 0-1000 for callbacks
        return { x, y, width: rect.width, height: rect.height };
    };

    const toNorm = (val: number, max: number) => Math.max(0, Math.min(1000, Math.round((val / max) * 1000)));
    const fromNorm = (val: number, max: number) => (val / 1000) * max;

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const { x, y, width, height } = getMousePos(e);

        // 1. Check if clicking on a resize handle of the selected box
        if (selectedFaceIndex !== null) {
            const face = faces[selectedFaceIndex];
            const [ymin, xmin, ymax, xmax] = face.box_2d;
            const pxYmin = fromNorm(ymin, height);
            const pxXmin = fromNorm(xmin, width);
            const pxYmax = fromNorm(ymax, height);
            const pxXmax = fromNorm(xmax, width);

            const HANDLE_SIZE = 10;

            // Check handles
            if (Math.abs(x - pxXmin) < HANDLE_SIZE && Math.abs(y - pxYmin) < HANDLE_SIZE) { setIsResizing('tl'); return; }
            if (Math.abs(x - pxXmax) < HANDLE_SIZE && Math.abs(y - pxYmin) < HANDLE_SIZE) { setIsResizing('tr'); return; }
            if (Math.abs(x - pxXmin) < HANDLE_SIZE && Math.abs(y - pxYmax) < HANDLE_SIZE) { setIsResizing('bl'); return; }
            if (Math.abs(x - pxXmax) < HANDLE_SIZE && Math.abs(y - pxYmax) < HANDLE_SIZE) { setIsResizing('br'); return; }

            // Check if clicking inside the selected box (to move)
            if (x >= pxXmin && x <= pxXmax && y >= pxYmin && y <= pxYmax) {
                setIsDragging(true);
                setDragStart({ x, y });
                return;
            }
        }

        // 2. Check if clicking on any OTHER box (to select)
        // iterate in reverse to select top-most
        for (let i = faces.length - 1; i >= 0; i--) {
            const face = faces[i];
            const [ymin, xmin, ymax, xmax] = face.box_2d;
            if (x >= fromNorm(xmin, width) && x <= fromNorm(xmax, width) &&
                y >= fromNorm(ymin, height) && y <= fromNorm(ymax, height)) {
                onSelectFace(i);
                // Start dragging immediately if needed, or just select
                setIsDragging(true);
                setDragStart({ x, y });
                return;
            }
        }

        // 3. If clicking empty space, start creating
        onSelectFace(null);
        setIsCreating(true);
        setDragStart({ x, y });
        setCurrentBox([toNorm(y, height), toNorm(x, width), toNorm(y, height), toNorm(x, width)]);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const { x, y, width, height } = getMousePos(e);

        if (isResizing && selectedFaceIndex !== null) {
            const face = faces[selectedFaceIndex];
            let [ymin, xmin, ymax, xmax] = face.box_2d;

            const normY = toNorm(y, height);
            const normX = toNorm(x, width);

            if (isResizing === 'tl') { ymin = normY; xmin = normX; }
            if (isResizing === 'tr') { ymin = normY; xmax = normX; }
            if (isResizing === 'bl') { ymax = normY; xmin = normX; }
            if (isResizing === 'br') { ymax = normY; xmax = normX; }

            // Ensure min < max
            // (Simple swap if dragged past)
            const newYmin = Math.min(ymin, ymax);
            const newYmax = Math.max(ymin, ymax);
            const newXmin = Math.min(xmin, xmax);
            const newXmax = Math.max(xmin, xmax);

            onUpdateFace(selectedFaceIndex, [newYmin, newXmin, newYmax, newXmax]);
        } else if (isDragging && selectedFaceIndex !== null && dragStart) {
            const dx = x - dragStart.x;
            const dy = y - dragStart.y;

            const face = faces[selectedFaceIndex];
            const [ymin, xmin, ymax, xmax] = face.box_2d;

            const normDy = toNorm(dy, height) - toNorm(0, height); // roughly
            const normDx = toNorm(dx, width) - toNorm(0, width);

            // We need better delta calculation to avoid drift/snap
            // Convert current box to pixels, add delta, convert back
            const pxYmin = fromNorm(ymin, height);
            const pxXmin = fromNorm(xmin, width);
            const pxYmax = fromNorm(ymax, height);
            const pxXmax = fromNorm(xmax, width);

            const newPxYmin = pxYmin + dy;
            const newPxXmin = pxXmin + dx;
            const newPxYmax = pxYmax + dy;
            const newPxXmax = pxXmax + dx;

            // Clamp to image bounds
            // TODO: Improve clamping logic

            onUpdateFace(selectedFaceIndex, [
                toNorm(newPxYmin, height),
                toNorm(newPxXmin, width),
                toNorm(newPxYmax, height),
                toNorm(newPxXmax, width)
            ]);
            setDragStart({ x, y });
        } else if (isCreating && dragStart) {
            // Update currentBox for rendering the preview
            const startX = dragStart.x;
            const startY = dragStart.y;

            const pxYmin = Math.min(startY, y);
            const pxXmin = Math.min(startX, x);
            const pxYmax = Math.max(startY, y);
            const pxXmax = Math.max(startX, x);

            setCurrentBox([
                toNorm(pxYmin, height),
                toNorm(pxXmin, width),
                toNorm(pxYmax, height),
                toNorm(pxXmax, width)
            ]);
        }
    };

    const handleMouseUp = () => {
        if (isCreating && currentBox) {
            // Check if box is big enough
            const [ymin, xmin, ymax, xmax] = currentBox;
            if (Math.abs(ymax - ymin) > 20 && Math.abs(xmax - xmin) > 20) {
                onAddFace(currentBox);
            }
        }
        setIsDragging(false);
        setIsResizing(null);
        setIsCreating(false);
        setDragStart(null);
        setCurrentBox(null);
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            <img
                ref={imgRef}
                src={imageSrc}
                alt="Target"
                className="w-full h-auto pointer-events-none display-block"
            />

            {/* Existing Faces */}
            {faces.map((face, idx) => {
                const isSelected = idx === selectedFaceIndex;
                const [ymin, xmin, ymax, xmax] = face.box_2d;

                return (
                    <div
                        key={face.id || idx}
                        className={`absolute border-2 ${isSelected ? 'border-yellow-400 z-10' : 'border-indigo-500/50 hover:border-indigo-400 z-0'}`}
                        style={{
                            top: `${ymin / 10}%`,
                            left: `${xmin / 10}%`,
                            height: `${(ymax - ymin) / 10}%`,
                            width: `${(xmax - xmin) / 10}%`,
                            cursor: isSelected ? 'move' : 'pointer'
                        }}
                    >
                        {isSelected && (
                            <>
                                {/* Resize Handles */}
                                <div className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-yellow-400 rounded-full cursor-nw-resize" />
                                <div className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-yellow-400 rounded-full cursor-ne-resize" />
                                <div className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-yellow-400 rounded-full cursor-sw-resize" />
                                <div className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-yellow-400 rounded-full cursor-se-resize" />

                                {/* Delete Button */}
                                <button
                                    className="absolute -top-8 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded shadow pointer-events-auto hover:bg-red-600"
                                    onMouseDown={(e) => {
                                        e.stopPropagation(); // prevent drag start
                                        onDeleteFace(idx);
                                    }}
                                >
                                    삭제
                                </button>
                            </>
                        )}

                        {/* Number Indicator */}
                        <div className="absolute top-0 left-0 bg-black/50 text-white text-[10px] px-1 pointer-events-none">
                            {idx + 1}
                        </div>
                    </div>
                );
            })}

            {/* Creation Preview */}
            {isCreating && currentBox && (
                <div
                    className="absolute border-2 border-green-500 bg-green-500/20 z-20"
                    style={{
                        top: `${currentBox[0] / 10}%`,
                        left: `${currentBox[1] / 10}%`,
                        height: `${(currentBox[2] - currentBox[0]) / 10}%`,
                        width: `${(currentBox[3] - currentBox[1]) / 10}%`,
                    }}
                />
            )}
        </div>
    );
};
