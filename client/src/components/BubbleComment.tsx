import React from 'react';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BubbleCommentProps {
    threadId: string;
    messageCount: number;
    style?: React.CSSProperties;
    onClick?: () => void;
    isActive?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: () => void;
    children?: React.ReactNode;
}

const BubbleComment: React.FC<BubbleCommentProps> = ({
    threadId,
    messageCount,
    style,
    onClick,
    isActive,
    isCollapsed,
    onToggleCollapse,
    children
}) => {
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // 触发跳转事件
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('switchToChat', {
                detail: { threadId }
            }));
        }
        onClick?.();
    };

    return (
        <div
            className={`
                group relative flex items-start gap-2
                ${isActive ? 'z-50' : 'z-40'}
            `}
            style={style}
        >
            <Button
                size="sm"
                variant="ghost"
                className={`
                    h-6 w-6 rounded-full p-0 hover:bg-blue-100
                    ${isActive ? 'bg-blue-100' : 'bg-white/80'}
                    shadow-sm hover:shadow-md transition-all duration-200
                `}
                onClick={handleClick}
            >
                <MessageCircle className="h-4 w-4 text-blue-500" />
                {messageCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-blue-500 text-[10px] font-medium text-white flex items-center justify-center">
                        {messageCount}
                    </span>
                )}
            </Button>

            {/* Expanded content */}
            {!isCollapsed && children && (
                <div className="absolute left-8 top-0 min-w-[200px] max-w-[300px] rounded-lg bg-white p-3 shadow-lg">
                    {children}
                </div>
            )}
        </div>
    );
};

export default BubbleComment; 