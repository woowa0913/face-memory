import React, { useState, useRef, useEffect } from 'react';

interface FaceBoxOverlayProps {
    imageSrc: string;
    faces: {
        id?: string;
        box_2d: [number, number, number, number];
        info_box_2d?: [number, number, number, number];
    }[]; // [ymin, xmin, ymax, xmax] 0-1000
    selectedFaceIndex: number | null;
    onSelectFace: (index: number | null) => void;
    onUpdateFace: (index: number, newBox: [number, number, number, number]) => void;
    onUpdateInfoBox?: (index: number, newBox: [number, number, number, number]) => void;
    onAddFace: (newBox: [number, number, number, number]) => void;
    onDeleteFace: (index: number) => void;
    onInteractionEnd: (index: number) => void;
    onInfoInteractionEnd?: (index: number) => void;
}

export const FaceBoxOverlay: React.FC<FaceBoxOverlayProps> = ({
    imageSrc,
    faces,
    selectedFaceIndex,
    onSelectFace,
    onUpdateFace,
    onUpdateInfoBox,
    onAddFace,
    onDeleteFace,
    onInteractionEnd,
    onInfoInteractionEnd
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement>(null);

    // Interaction State
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState<string | null>(null); // 'tl', 'tr', 'bl', 'br'
    const [createMode, setCreateMode] = useState(false);

    // Track what we are editing: 'face' | 'info'
    const [editTarget, setEditTarget] = useState<'face' | 'info'>('face');

    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [currentBox, setCurrentBox] = useState<[number, number, number, number] | null>(null); // For creation only

    const getMousePos = (e: React.MouseEvent | MouseEvent) => {
        if (!containerRef.current || !imgRef.current) return { x: 0, y: 0, width: 0, height: 0 };
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        return { x, y, width: rect.width, height: rect.height };
    };

    const toNorm = (val: number, max: number) => Math.max(0, Math.min(1000, Math.round((val / max) * 1000)));
    const fromNorm = (val: number, max: number) => (val / 1000) * max;

    const HANDLE_SIZE = 10;

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        const { x, y, width, height } = getMousePos(e);

        // 1. Check if clicking on selected face's handles or body (Face OR Info)
        if (selectedFaceIndex !== null) {
            const face = faces[selectedFaceIndex];

            // Check Info Box First (z-index logic: whatever is on top, but let's prioritize info if it exists/overlaps)
            // Actually, we should check both.

            // Helper to check hit
            const checkHit = (box: [number, number, number, number], type: 'face' | 'info') => {
                const [ymin, xmin, ymax, xmax] = box;
                const pxYmin = fromNorm(ymin, height);
                const pxXmin = fromNorm(xmin, width);
                const pxYmax = fromNorm(ymax, height);
                const pxXmax = fromNorm(xmax, width);

                // Resize Handles
                if (Math.abs(x - pxXmin) < HANDLE_SIZE && Math.abs(y - pxYmin) < HANDLE_SIZE) return { hit: true, action: 'resize', handle: 'tl', type };
                if (Math.abs(x - pxXmax) < HANDLE_SIZE && Math.abs(y - pxYmin) < HANDLE_SIZE) return { hit: true, action: 'resize', handle: 'tr', type };
                if (Math.abs(x - pxXmin) < HANDLE_SIZE && Math.abs(y - pxYmax) < HANDLE_SIZE) return { hit: true, action: 'resize', handle: 'bl', type };
                if (Math.abs(x - pxXmax) < HANDLE_SIZE && Math.abs(y - pxYmax) < HANDLE_SIZE) return { hit: true, action: 'resize', handle: 'br', type };

                // Body (Move)
                if (x >= pxXmin && x <= pxXmax && y >= pxYmin && y <= pxYmax) return { hit: true, action: 'move', type };

                return null;
            };

            // IF info box exists, check it
            if (face.info_box_2d) {
                const infoHit = checkHit(face.info_box_2d, 'info');
                if (infoHit) {
                    setEditTarget('info');
                    if (infoHit.action === 'resize') setIsResizing(infoHit.handle!);
                    else setIsDragging(true);
                    setDragStart({ x, y });
                    return;
                }
            }

            // Check Face Box
            const faceHit = checkHit(face.box_2d, 'face');
            if (faceHit) {
                setEditTarget('face');
                if (faceHit.action === 'resize') setIsResizing(faceHit.handle!);
                else setIsDragging(true);
                setDragStart({ x, y });
                return;
            }
        }

        // 2. Check ANY other face box to select
        for (let i = faces.length - 1; i >= 0; i--) {
            const face = faces[i];
            const [ymin, xmin, ymax, xmax] = face.box_2d;

            if (x >= fromNorm(xmin, width) && x <= fromNorm(xmax, width) &&
                y >= fromNorm(ymin, height) && y <= fromNorm(ymax, height)) {

                onSelectFace(i);
                setEditTarget('face'); // Default to face when selecting new
                setIsDragging(true);
                setDragStart({ x, y });
                return;
            }
        }

        // 3. Create New Face
        onSelectFace(null);
        setCreateMode(true);
        setDragStart({ x, y });
        setCurrentBox([toNorm(y, height), toNorm(x, width), toNorm(y, height), toNorm(x, width)]);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const { x, y, width, height } = getMousePos(e);

        if ((isDragging || isResizing) && selectedFaceIndex !== null && dragStart) {
            const face = faces[selectedFaceIndex];
            // Determine which box we are editing
            const targetBox = editTarget === 'face' ? face.box_2d : face.info_box_2d;
            if (!targetBox) return; // Should not happen if logic is correct

            let [ymin, xmin, ymax, xmax] = targetBox;

            if (isResizing) {
                // Clamp mouse position
                const clampedY = Math.max(0, Math.min(height, y));
                const clampedX = Math.max(0, Math.min(width, x));

                const normY = toNorm(clampedY, height);
                const normX = toNorm(clampedX, width);

                if (isResizing === 'tl') { ymin = normY; xmin = normX; }
                if (isResizing === 'tr') { ymin = normY; xmax = normX; }
                if (isResizing === 'bl') { ymax = normY; xmin = normX; }
                if (isResizing === 'br') { ymax = normY; xmax = normX; }

                // Swap check
                const newYmin = Math.min(ymin, ymax);
                const newYmax = Math.max(ymin, ymax);
                const newXmin = Math.min(xmin, xmax);
                const newXmax = Math.max(xmin, xmax);

                const newBox: [number, number, number, number] = [newYmin, newXmin, newYmax, newXmax];

                if (editTarget === 'face') onUpdateFace(selectedFaceIndex, newBox);
                else if (onUpdateInfoBox) onUpdateInfoBox(selectedFaceIndex, newBox);
            }
            else if (isDragging) {
                const dx = x - dragStart.x;
                const dy = y - dragStart.y;

                const pxYmin = fromNorm(ymin, height);
                const pxXmin = fromNorm(xmin, width);
                const pxYmax = fromNorm(ymax, height);
                const pxXmax = fromNorm(xmax, width);

                let newPxYmin = pxYmin + dy;
                let newPxXmin = pxXmin + dx;
                let newPxYmax = pxYmax + dy;
                let newPxXmax = pxXmax + dx;

                const boxW = pxXmax - pxXmin;
                const boxH = pxYmax - pxYmin;

                // Clamp
                if (newPxXmin < 0) { newPxXmin = 0; newPxXmax = boxW; }
                if (newPxYmin < 0) { newPxYmin = 0; newPxYmax = boxH; }
                if (newPxXmax > width) { newPxXmax = width; newPxXmin = width - boxW; }
                if (newPxYmax > height) { newPxYmax = height; newPxYmin = height - boxH; }

                const newBox: [number, number, number, number] = [
                    toNorm(newPxYmin, height),
                    toNorm(newPxXmin, width),
                    toNorm(newPxYmax, height),
                    toNorm(newPxXmax, width)
                ];

                if (editTarget === 'face') onUpdateFace(selectedFaceIndex, newBox);
                else if (onUpdateInfoBox) onUpdateInfoBox(selectedFaceIndex, newBox);

                setDragStart({ x, y });
            }
        } else if (createMode && dragStart) {
            // ... (Creation Logic same as before)
            const startX = dragStart.x;
            const startY = dragStart.y;
            // Clamp mouse position
            const clampedY = Math.max(0, Math.min(height, y));
            const clampedX = Math.max(0, Math.min(width, x));

            const pxYmin = Math.min(startY, clampedY);
            const pxXmin = Math.min(startX, clampedX);
            const pxYmax = Math.max(startY, clampedY);
            const pxXmax = Math.max(startX, clampedX);

            setCurrentBox([
                toNorm(pxYmin, height),
                toNorm(pxXmin, width),
                toNorm(pxYmax, height),
                toNorm(pxXmax, width)
            ]);
        }
    };

    const handleMouseUp = () => {
        if (createMode && currentBox) {
            const [ymin, xmin, ymax, xmax] = currentBox;
            if (Math.abs(ymax - ymin) > 20 && Math.abs(xmax - xmin) > 20) {
                onAddFace(currentBox);
            }
        }
        else if ((isDragging || isResizing) && selectedFaceIndex !== null) {
            if (editTarget === 'face') {
                onInteractionEnd(selectedFaceIndex);
            } else if (editTarget === 'info' && onInfoInteractionEnd) {
                onInfoInteractionEnd(selectedFaceIndex);
            }
        }

        setIsDragging(false);
        setIsResizing(null);
        setCreateMode(false);
        setDragStart(null);
        setCurrentBox(null);
    };

    // Render Helper
    const renderBox = (
        box: [number, number, number, number],
        type: 'face' | 'info',
        idx: number,
        isSelected: boolean
    ) => {
        const [ymin, xmin, ymax, xmax] = box;
        // Colors
        // Face: Indigo (Normal), Yellow (Selected)
        // Info: Green (Normal), Bright Green (Selected)

        let borderColor = 'border-indigo-500/50';
        let hoverColor = 'hover:border-indigo-400';
        let selectedColor = 'border-yellow-400';

        if (type === 'info') {
            borderColor = 'border-green-500/50';
            hoverColor = 'hover:border-green-400';
            selectedColor = 'border-green-400';
        }

        const isBoxSelected = isSelected && editTarget === type;
        // Note: When a face is selected, we show both boxes. 
        // But only the one we clicked recently (or default face) gets the "active editing" handles.
        // Let's simplify: If the person is selected, BOTH boxes are visible.
        // The one corresponding to editTarget gets the handles.

        // If this person is NOT selected, we only show Face box usually? 
        // Requirement: "번호는 얼굴하고 같게해서 같은 얼굴과 정보를 매칭할 수 있게 해줘."
        // Let's show Info box always if it exists, or maybe alpha it out if not selected.

        const isActive = isSelected && (editTarget === type); // This specific box is being edited

        return (
            <div
                key={`${type}-${idx}`}
                className={`absolute border-2 ${isSelected ? (isActive ? `${selectedColor} z-20` : `${borderColor} z-10 border-dashed`) : `${borderColor} z-0 ${hoverColor}`}`}
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
                        {/* Handles - Only if "Active" editing target */}
                        {isActive && (
                            <>
                                <div className={`absolute -top-1.5 -left-1.5 w-3 h-3 ${type === 'face' ? 'bg-yellow-400' : 'bg-green-400'} rounded-full cursor-nw-resize`} />
                                <div className={`absolute -top-1.5 -right-1.5 w-3 h-3 ${type === 'face' ? 'bg-yellow-400' : 'bg-green-400'} rounded-full cursor-ne-resize`} />
                                <div className={`absolute -bottom-1.5 -left-1.5 w-3 h-3 ${type === 'face' ? 'bg-yellow-400' : 'bg-green-400'} rounded-full cursor-sw-resize`} />
                                <div className={`absolute -bottom-1.5 -right-1.5 w-3 h-3 ${type === 'face' ? 'bg-yellow-400' : 'bg-green-400'} rounded-full cursor-se-resize`} />
                            </>
                        )}

                        {/* Delete Button - Only on Face Box */}
                        {type === 'face' && (
                            <button
                                className="absolute -top-8 right-0 bg-red-500 text-white text-xs px-2 py-1 rounded shadow pointer-events-auto hover:bg-red-600"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    onDeleteFace(idx);
                                }}
                            >
                                삭제
                            </button>
                        )}
                    </>
                )}

                {/* Number Indicator - Show on both to match */}
                <div className={`absolute top-0 left-0 ${type === 'face' ? 'bg-black/50' : 'bg-green-700/70'} text-white text-[10px] px-1 pointer-events-none`}>
                    {idx + 1} {type === 'info' && '정보'}
                </div>
            </div>
        );
    };

    return (
        <div
            ref={containerRef}
            className="relative w-full h-auto select-none"
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

            {faces.map((face, idx) => {
                const isSelected = idx === selectedFaceIndex;
                return (
                    <React.Fragment key={face.id || idx}>
                        {renderBox(face.box_2d, 'face', idx, isSelected)}
                        {face.info_box_2d && renderBox(face.info_box_2d, 'info', idx, isSelected)}
                    </React.Fragment>
                );
            })}

            {/* Creation Preview */}
            {createMode && currentBox && (
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

