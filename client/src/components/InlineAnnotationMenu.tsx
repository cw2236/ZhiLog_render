import {
    PaperHighlight,
} from '@/lib/schema';

import { getSelectionOffsets } from "./utils/PdfTextUtils";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { CommandShortcut, localizeCommandToOS } from "./ui/command";
import { Copy, Highlighter, MessageCircle, Minus, X } from "lucide-react";

interface InlineAnnotationMenuProps {
    selectedText: string;
    tooltipPosition: { x: number; y: number } | null;
    setSelectedText: (text: string) => void;
    setTooltipPosition: (position: { x: number; y: number } | null) => void;
    setIsAnnotating: (isAnnotating: boolean) => void;
    highlights: Array<PaperHighlight>;
    setHighlights: (highlights: Array<PaperHighlight>) => void;
    isHighlightInteraction: boolean;
    activeHighlight: PaperHighlight | null;
    addHighlight: (selectedText: string, startOffset?: number, endOffset?: number) => void;
    removeHighlight: (highlight: PaperHighlight) => void;
    setUserMessageReferences: React.Dispatch<React.SetStateAction<string[]>>;
}

export default function InlineAnnotationMenu(props: InlineAnnotationMenuProps) {
    const {
        selectedText,
        tooltipPosition,
        setSelectedText,
        setTooltipPosition,
        setIsAnnotating,
        isHighlightInteraction,
        activeHighlight,
        addHighlight,
        removeHighlight,
        setUserMessageReferences,
    } = props;

    const [offsets, setOffsets] = useState<{ start: number; end: number } | null>(null);
    const [savedSelection, setSavedSelection] = useState<string>("");

    useEffect(() => {
        if (selectedText) {
            const offsets = getSelectionOffsets();
            if (offsets) {
                setOffsets(offsets);
            }
        }

        const handleMouseDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setSelectedText("");
                setTooltipPosition(null);
                setIsAnnotating(false);
            } else if (e.key === "c" && (e.ctrlKey || e.metaKey)) {
                navigator.clipboard.writeText(selectedText);
            } else if (e.key === "a" && (e.ctrlKey || e.metaKey)) {
                setUserMessageReferences((prev: string[]) => {
                    const newReferences = [...prev, selectedText];
                    return Array.from(new Set(newReferences)); // Remove duplicates
                });
            } else if (e.key === "h" && (e.ctrlKey || e.metaKey)) {
                addHighlight(selectedText, offsets?.start, offsets?.end);
                e.stopPropagation();
            } else if (e.key === "d" && (e.ctrlKey || e.metaKey) && isHighlightInteraction && activeHighlight) {
                removeHighlight(activeHighlight);
                setSelectedText("");
                setTooltipPosition(null);
                setIsAnnotating(false);
            } else if (e.key === "e" && (e.ctrlKey || e.metaKey)) {
                setIsAnnotating(true);
                setTooltipPosition(null);
                setSelectedText("");
            } else {
                return;
            }

            e.preventDefault();
            e.stopPropagation();
        }

        window.addEventListener("keydown", handleMouseDown);
        return () => window.removeEventListener("keydown", handleMouseDown);
    }, [selectedText]);

    if (!tooltipPosition) return null;

    return (
        <div
            className="fixed z-30 bg-background shadow-lg rounded-lg p-3 border border-border w-[200px]"
            style={{
                left: `${Math.min(tooltipPosition.x, window.innerWidth - 220)}px`,
                top: `${tooltipPosition.y + 20}px`,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
        >
            <div className="flex flex-col gap-1.5">
                {/* Copy Button */}
                <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between text-sm font-normal h-9 px-2"
                    onClick={() => {
                        navigator.clipboard.writeText(selectedText);
                        setSelectedText("");
                        setTooltipPosition(null);
                        setIsAnnotating(false);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Copy size={14} />
                        Copy
                    </div>
                    <CommandShortcut className="text-muted-foreground">
                        {localizeCommandToOS('C')}
                    </CommandShortcut>
                </Button>

                {/* Highlight Button */}
                {
                    !isHighlightInteraction && (
                        <Button
                            variant="ghost"
                            className="w-full flex items-center justify-between text-sm font-normal h-9 px-2"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.stopPropagation();
                                addHighlight(selectedText, offsets?.start, offsets?.end);
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Highlighter size={14} />
                                Highlight
                            </div>
                            <CommandShortcut className="text-muted-foreground">
                                {localizeCommandToOS('H')}
                            </CommandShortcut>
                        </Button>
                    )
                }

                {/* Annotate Button */}
                {
                    isHighlightInteraction && (
                        <Button
                            variant="ghost"
                            className="w-full flex items-center justify-between text-sm font-normal h-9 px-2"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsAnnotating(true);
                                setTooltipPosition(null);
                                setSelectedText("");
                            }}
                        >
                            <div className="flex items-center gap-2">
                                <Highlighter size={14} />
                                Annotate
                            </div>
                            <CommandShortcut className="text-muted-foreground">
                                {localizeCommandToOS('E')}
                            </CommandShortcut>
                        </Button>
                    )
                }

                {/* Add to Chat Button */}
                <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between text-sm font-normal h-9 px-2"
                    onMouseDown={(e) => {
                        e.preventDefault();
                        // 保存当前选择
                        const currentSelection = window.getSelection();
                        setSavedSelection(currentSelection?.toString().trim() || "");
                    }}
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        // 使用保存的选择
                        const textToUse = savedSelection || selectedText;
                        
                        if (!textToUse || !textToUse.trim()) {
                            console.log('No selected text, showing alert');
                            alert('Please select a text first to add to Chat');
                            return;
                        }
                        
                        console.log('Proceeding with Add to Chat for text:', textToUse);
                        // 先创建高亮
                        addHighlight(textToUse, offsets?.start, offsets?.end);
                        // 通过自定义事件通知主页面新建thread
                        if (typeof window !== 'undefined') {
                            window.dispatchEvent(new CustomEvent('addBubbleCommentThread', { 
                                detail: { 
                                    text: textToUse,
                                    shouldSwitchToChat: true // 添加标志
                                } 
                            }));
                        }
                        setTooltipPosition(null);
                        setIsAnnotating(false);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <MessageCircle size={14} />
                        Add to Chat
                    </div>
                    <CommandShortcut className="text-muted-foreground">
                        {localizeCommandToOS('A')}
                    </CommandShortcut>
                </Button>


                {/* Remove Highlight Button - Only show when interacting with highlight */}
                {isHighlightInteraction && activeHighlight && (
                    <Button
                        variant="ghost"
                        className="w-full flex items-center justify-between text-sm font-normal h-9 px-2 text-destructive"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                            e.stopPropagation();
                            if (activeHighlight) {
                                removeHighlight(activeHighlight);
                                setSelectedText("");
                                setTooltipPosition(null);
                                setIsAnnotating(false);
                            }
                        }}
                    >
                        <div className="flex items-center gap-2">
                            <Minus size={14} />
                            Remove
                        </div>
                        <CommandShortcut className="text-muted-foreground">
                            {localizeCommandToOS('D')}
                        </CommandShortcut>
                    </Button>
                )}

                {/* Close Button */}
                <Button
                    variant="ghost"
                    className="w-full flex items-center justify-between text-sm font-normal h-9 px-2"
                    onClick={() => {
                        setSelectedText("");
                        setTooltipPosition(null);
                        setIsAnnotating(false);
                    }}
                >
                    <div className="flex items-center gap-2">
                        <X size={14} />
                        Close
                    </div>
                    <CommandShortcut className="text-muted-foreground">
                        Esc
                    </CommandShortcut>
                </Button>
            </div>
        </div>
    );
}
