'use client';

import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import { User, MessageCircle, MoreHorizontal, Loader } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/lib/auth';
import { ChatMessage } from '@/lib/schema';
import { fetchStreamFromApi, saveChatHistory, getChatHistory } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import CustomCitationLink from '@/components/utils/CustomCitationLink';

interface CommentStyleChatProps {
    messages: ChatMessage[];
    isStreaming: boolean;
    // onSendMessage: (message: string, selectedText?: string) => void; // 移除
    selectedText?: string;
    onClearSelectedText: () => void;
    // 新增评论线程相关 props
    commentThreads?: CommentThread[];
    setCommentThreads?: (threads: CommentThread[] | ((prev: CommentThread[]) => CommentThread[])) => void;
    activeThreadId?: string | null;
    setActiveThreadId?: (threadId: string | null) => void;
    // 新增高亮相关 props
    activeHighlight?: any; // 当前活跃的高亮
    // 新增对话相关 props
    paperId?: string;
    conversationId?: string;
    // 新增llmProvider
    llmProvider?: string;
}

interface CommentThread {
    id: string;
    highlightId?: string; // 新增，绑定高亮
    selectedText: string;
    messages: ChatMessage[];
    isExpanded: boolean;
    conversationId?: string; // 每个线程的独立对话ID
}

const END_DELIMITER = "END_OF_STREAM";

// 生成唯一id函数
const generateUniqueId = () => {
    if (typeof window !== 'undefined' && window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random()}`;
};

const CommentStyleChat = forwardRef(function CommentStyleChat({
    messages,
    isStreaming,
    // onSendMessage, // 移除
    selectedText,
    onClearSelectedText,
    commentThreads: propCommentThreads, // 接收评论线程数据
    setCommentThreads: propSetCommentThreads, // 接收设置评论线程的函数
    activeThreadId: propActiveThreadId, // 接收活跃线程 ID
    setActiveThreadId: propSetActiveThreadId, // 接收设置活跃线程 ID 的函数
    activeHighlight, // 接收活跃高亮
    paperId,
    conversationId,
    llmProvider // 新增
}: CommentStyleChatProps, ref) {
    const { user } = useAuth();
    
    // 使用传入的 props 或内部状态
    const [internalCommentThreads, setInternalCommentThreads] = useState<CommentThread[]>([]);
    const [internalActiveThreadId, setInternalActiveThreadId] = useState<string | null>(null);
    
    const commentThreads = propCommentThreads || internalCommentThreads;
    const setCommentThreads = propSetCommentThreads || setInternalCommentThreads;
    const activeThreadId = propActiveThreadId !== undefined ? propActiveThreadId : internalActiveThreadId;
    const setActiveThreadId = propSetActiveThreadId || setInternalActiveThreadId;
    
    const [currentInput, setCurrentInput] = useState('');
    const [threadStreaming, setThreadStreaming] = useState<string | null>(null); // 记录哪个线程正在流式传输
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // 加载聊天历史
    useEffect(() => {
        const loadChatHistory = async () => {
            if (!paperId || !user) return;

            try {
                const history = await getChatHistory(paperId, 'comment');
                console.log('Loaded chat history from backend:', history);
                if (history && Array.isArray(history)) {
                    // 按 thread_id 分组消息
                    const threadMessages = history.reduce((acc, msg) => {
                        console.log('Processing message from backend:', { 
                            thread_id: msg.thread_id, 
                            role: msg.role, 
                            message: msg.message?.substring(0, 50) + '...',
                            isUser: msg.role === 'user',
                            isAssistant: msg.role === 'assistant'
                        });
                        
                        if (!msg.thread_id) return acc;
                        
                        if (!acc[msg.thread_id]) {
                            acc[msg.thread_id] = {
                                id: msg.thread_id,
                                messages: [],
                                selectedText: '', // 初始化为空，稍后从第一条用户消息中提取
                                isExpanded: false
                            };
                        }
                        
                        acc[msg.thread_id].messages.push({
                            role: msg.role,
                            content: msg.message,
                            references: msg.references
                        });
                        
                        return acc;
                    }, {} as Record<string, CommentThread>);

                    // 为每个线程设置 selectedText
                    Object.values(threadMessages).forEach((thread) => {
                        const commentThread = thread as CommentThread;
                        // 找到第一条用户消息，直接使用作为选中的文本
                        const firstUserMessage = commentThread.messages.find((msg: ChatMessage) => msg.role === 'user');
                        if (firstUserMessage) {
                            // 直接使用第一条用户消息作为选中的文本
                            commentThread.selectedText = firstUserMessage.content;
                        }
                    });

                    setCommentThreads(Object.values(threadMessages));
                }
            } catch (error) {
                console.error("Error loading chat history:", error);
            }
        };

        loadChatHistory();
    }, [paperId, user]);

    // 保存评论线程到本地存储
    useEffect(() => {
        if (paperId && commentThreads.length > 0) {
            try {
                localStorage.setItem(`comment-threads-${paperId}`, JSON.stringify(commentThreads));
            } catch (error) {
                console.error('Error saving comment threads to localStorage:', error);
            }
        }
    }, [commentThreads, paperId]);

    // 当有新的选中文本时，创建新的评论线程
    const setActiveThreadIdWithLog = (threadId: string | null) => {
        console.log('setActiveThreadId', threadId);
        setActiveThreadId(threadId);
    };

    // 新建thread并立即发送消息
    const createThreadAndSend = async (text: string, message: string) => {
        console.log('createThreadAndSend called', { text, message, activeHighlight, existingThreads: commentThreads.length });
        
        // 检查是否已经存在相同选中文本的线程
        const existingThread = commentThreads.find(thread => {
            return thread.selectedText === text;
        });
        
        if (existingThread) {
            console.log('Thread already exists for this text:', existingThread);
            // 如果线程已存在，激活它而不是创建新的
            setActiveThreadIdWithLog(existingThread.id);
            return;
        }
        
        console.log('Creating new thread for text:', text);
        const newId = generateUniqueId();
        const newThread: CommentThread = {
            id: newId,
            highlightId: activeHighlight?.id,
            selectedText: text, // 这是选中的文本
            messages: [],
            isExpanded: true,
            conversationId: undefined
        };
        console.log('Creating new thread', newThread);
        
        // 保存选中的文本到后端（作为 selectedText）
        if (paperId && user) {
            try {
                // 直接保存选中的文本，不使用特殊标记
                await saveChatHistory(paperId, text, 'user', 'comment', newId);
                console.log('Successfully saved to backend');
            } catch (error) {
                console.error('Error saving chat history:', error);
            }
        }
        
        setCommentThreads((prev: CommentThread[]) => {
            console.log('Setting comment threads', { prev: prev.length, newThread });
            const updated = [...prev, newThread];
            setActiveThreadIdWithLog(newId);
            if (message) {
                setTimeout(() => handleSendMessage(newId, message), 0);
            }
            return updated;
        });
        onClearSelectedText();
    };

    // useEffect中不再直接新建thread，只清空选中文本
    useEffect(() => {
        if (selectedText && selectedText.trim()) {
            onClearSelectedText();
        }
    }, [selectedText, onClearSelectedText]);

    // 监听高亮变化，更新评论线程的 highlightId
    useEffect(() => {
        if (activeHighlight?.id && activeThreadId) {
            setCommentThreads((prev: CommentThread[]) => prev.map((thread: CommentThread) => 
                thread.id === activeThreadId 
                    ? { ...thread, highlightId: activeHighlight.id }
                    : thread
            ));
        }
    }, [activeHighlight?.id, activeThreadId, setCommentThreads]);

    // 处理线程内的AI对话
    const handleThreadMessage = async (threadId: string, message: string) => {
        console.log('handleThreadMessage', { threadId, message });
        const thread = commentThreads.find(t => t.id === threadId);
        console.log('thread', thread, 'paperId', paperId);
        if (!thread || !paperId) {
            console.warn('No thread or paperId', { thread, paperId });
            return;
        }

        // 添加用户消息到线程
        const userMessage: ChatMessage = {
            role: 'user',
            content: message,
            id: Date.now().toString()
        };

        setCommentThreads((prev: CommentThread[]) => prev.map((t: CommentThread) => 
            t.id === threadId 
                ? { ...t, messages: [...t.messages, userMessage] }
                : t
        ));

        // 保存用户消息到后端
        if (paperId && user) {
            try {
                await saveChatHistory(paperId, message, 'user', 'comment', threadId);
            } catch (error) {
                console.error('Error saving user message:', error);
            }
        }

        setThreadStreaming(threadId);
        setCurrentInput('');

        try {
            // 为线程创建或获取对话ID
            let threadConversationId = thread.conversationId;
            if (!threadConversationId) {
                // 创建新的对话
                const response = await fetch(`/api/conversation/${paperId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ paper_id: paperId })
                });
                const data = await response.json();
                threadConversationId = data.id;
                
                // 更新线程的对话ID
                setCommentThreads((prev: CommentThread[]) => prev.map((t: CommentThread) => 
                    t.id === threadId 
                        ? { ...t, conversationId: threadConversationId }
                        : t
                ));
            }

            // 发送消息到AI
            const requestBody: any = {
                user_query: message,
                conversation_id: threadConversationId,
                paper_id: paperId,
                user_references: [thread.selectedText] // 直接使用选中的文本作为引用
            };
            if (llmProvider) {
                requestBody.llm_provider = llmProvider;
            }
            const stream = await fetchStreamFromApi('/api/message/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const reader = stream.getReader();
            const decoder = new TextDecoder();
            let accumulatedContent = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();

                if (done) {
                    if (buffer.trim()) {
                        console.warn('Unprocessed buffer at end of stream:', buffer);
                    }
                    break;
                }

                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                const parts = buffer.split(END_DELIMITER);
                buffer = parts.pop() || '';

                for (const part of parts) {
                    if (!part.trim()) continue;

                    try {
                        const event = JSON.parse(part);

                        if (event.type === 'content') {
                            accumulatedContent += event.content;
                        } else if (event.type === 'error') {
                            console.error('Stream error:', event.content);
                            throw new Error(event.content);
                        }
                    } catch (parseError) {
                        console.error('Error parsing event:', parseError, 'Raw part:', part);
                    }
                }
            }

            // 添加AI回复到线程
            if (accumulatedContent) {
                const aiMessage: ChatMessage = {
                    role: 'assistant',
                    content: accumulatedContent,
                    id: Date.now().toString()
                };

                setCommentThreads((prev: CommentThread[]) => prev.map((t: CommentThread) => 
                    t.id === threadId 
                        ? { ...t, messages: [...t.messages, aiMessage] }
                        : t
                ));

                // 保存AI回复到后端
                if (paperId && user) {
                    try {
                        await saveChatHistory(paperId, accumulatedContent, 'assistant', 'comment', threadId);
                    } catch (error) {
                        console.error('Error saving AI message:', error);
                    }
                }
            }

        } catch (error) {
            console.error('Error during thread message:', error);
            // 添加错误消息
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: 'Sorry, an error occurred. Please try again later.',
                id: Date.now().toString()
            };

            setCommentThreads((prev: CommentThread[]) => prev.map((t: CommentThread) => 
                t.id === threadId 
                    ? { ...t, messages: [...t.messages, errorMessage] }
                    : t
            ));
        } finally {
            setThreadStreaming(null);
        }
    };

    // 修改handleSendMessage逻辑
    const handleSendMessage = async (threadId: string, message: string) => {
        console.log('handleSendMessage', { currentInput, activeThreadId });
        if (!message.trim() || threadStreaming) return;
        const thread = commentThreads.find(t => t.id === threadId);
        if (!thread && selectedText) {
            // 新建thread并发送
            createThreadAndSend(selectedText, message);
        } else if (activeThreadId) {
            handleThreadMessage(activeThreadId, message);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(activeThreadId || '', currentInput);
        }
    };

    const toggleThread = (threadId: string) => {
        setCommentThreads((prev: CommentThread[]) => prev.map((thread: CommentThread) => 
            thread.id === threadId 
                ? { ...thread, isExpanded: !thread.isExpanded }
                : thread
        ));
    };

    const deleteThread = async (threadId: string) => {
        // 添加确认对话框
        if (!confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
            return;
        }
        
        console.log('Deleting thread:', threadId, 'paperId:', paperId, 'user:', user);
        
        // 从后端删除聊天历史
        if (paperId && user) {
            try {
                const response = await fetch(`/api/chat-history/paper/${paperId}?chat_type=comment&thread_id=${threadId}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                });
                
                console.log('Delete response status:', response.status);
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('Delete failed:', errorText);
                    alert('Delete failed. Please try again later.');
                    return;
                } else {
                    console.log('Delete successful');
                }
            } catch (error) {
                console.error('Error deleting chat history from backend:', error);
                alert('Delete failed. Please try again later.');
                return;
            }
        }

        // 从前端状态中删除
        setCommentThreads((prev: CommentThread[]) => prev.filter((thread: CommentThread) => thread.id !== threadId));
        if (activeThreadId === threadId) {
            setActiveThreadId(null);
        }
        
        // 更新本地存储
        if (paperId) {
            try {
                const updatedThreads = commentThreads.filter(thread => thread.id !== threadId);
                if (updatedThreads.length > 0) {
                    localStorage.setItem(`comment-threads-${paperId}`, JSON.stringify(updatedThreads));
                } else {
                    localStorage.removeItem(`comment-threads-${paperId}`);
                }
            } catch (error) {
                console.error('Error updating localStorage after deleting thread:', error);
            }
        }
    };

    const continueThread = (threadId: string) => {
        setActiveThreadIdWithLog(threadId);
        inputRef.current?.focus();
    };

    // 在CommentStyleChat组件内实现handleCitationClick
    const handleCitationClick = (key: string, messageIndex: number) => {
        console.log('Citation clicked:', { key, messageIndex });
        
        // 从引用中提取文本
        const thread = commentThreads.find(t => t.messages[messageIndex]);
        const message = thread?.messages[messageIndex];
        const citation = message?.references?.citations?.find(c => c.key === key);
        
        console.log('Found citation:', { thread, message, citation });
        
        if (citation) {
            // 移除引号，获取纯文本
            const searchText = citation.reference.replace(/^["']|["']$/g, '').trim();
            console.log('Extracted search text:', searchText);
            
            // 创建一个临时的高亮元素ID
            const highlightId = `citation-${key}-${messageIndex}`;
            
            // 触发搜索和跳转
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('jumpToHighlight', { 
                    detail: { 
                        key: highlightId,
                        messageIndex,
                        searchText,
                        shouldHighlight: true
                    }
                });
                console.log('Dispatching event:', event);
                window.dispatchEvent(event);
            }
        } else {
            console.warn('Citation not found:', { key, messageIndex });
        }
    };

    useImperativeHandle(ref, () => ({
        createThreadAndSend
    }));

    console.log('CommentStyleChat render', { 
        commentThreads: commentThreads.length, 
        activeThreadId, 
        paperId,
        hasRef: !!ref 
    });

    if (commentThreads.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground p-8">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center backdrop-blur-sm mb-4">
                    <MessageCircle className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2 gradient-text">No Conversations Yet</h3>
                <p className="text-sm">Select text in the document to start a conversation with AI</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-gradient-to-b from-background/50 via-background/30 to-background/50 backdrop-blur-sm rounded-xl border border-border/20 overflow-hidden modern-shadow">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border/20 bg-background/80 backdrop-blur-md">
                <h3 className="text-lg font-semibold gradient-text">AI Conversations</h3>
                <span className="text-sm text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">{commentThreads.length} threads</span>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-4 p-4">
                {commentThreads.map((thread) => (
                    <div 
                        key={thread.id} 
                        data-thread-id={thread.id}
                        className={`modern-card p-4 ${
                            activeThreadId === thread.id ? 'ring-2 ring-primary/50 shadow-lg' : ''
                        } hover:scale-[1.02] transition-all duration-300`}
                    >
                        {/* Selected Text Header */}
                        <div className="p-3 border-b border-border/20 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg mb-3">
                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <blockquote className="text-sm text-foreground italic border-l-2 border-primary pl-3">
                                        "{thread.selectedText || 'No selected text'}"
                                    </blockquote>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-muted/50">
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="modern-card">
                                        <DropdownMenuItem onClick={() => continueThread(thread.id)}>
                                            Continue conversation
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => toggleThread(thread.id)}>
                                            {thread.isExpanded ? 'Collapse' : 'Expand'}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem 
                                            onClick={() => deleteThread(thread.id)}
                                            className="text-destructive"
                                        >
                                            Delete
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        {/* Messages */}
                        {thread.isExpanded && (
                            <div className="space-y-3">
                                {thread.messages.map((message, index) => {
                                    // 添加调试日志
                                    console.log('Rendering message:', { 
                                        index, 
                                        role: message.role, 
                                        content: message.content.substring(0, 50) + '...',
                                        isUser: message.role === 'user',
                                        isAssistant: message.role === 'assistant'
                                    });
                                    
                                    return (
                                    <div key={index} className="flex gap-3 animate-fade-in">
                                        <Avatar className="h-12 w-12 flex-shrink-0 bg-transparent">
                                            {message.role === 'user' ? (
                                                // 用户消息
                                                user?.picture ? (
                                                    <img 
                                                        src={user.picture} 
                                                        alt={user.name}
                                                        className="w-8 h-8 rounded-full shadow-lg"
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            const avatar = e.currentTarget.closest('.h-12');
                                                            const userIcon = avatar?.querySelector('.user-icon');
                                                            if (userIcon) {
                                                                userIcon.classList.remove('hidden');
                                                            }
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center shadow-lg">
                                                        <User size={16} className="text-muted-foreground" />
                                                    </div>
                                                )
                                            ) : (
                                                // AI消息
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                                                    <img src="/ZhiLog%20Logo%20.jpg" alt="ZhiLog" className="w-5 h-5 rounded" />
                                                </div>
                                            )}
                                            {message.role === 'user' && user?.picture && (
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center shadow-lg user-icon hidden">
                                                    <User size={16} className="text-muted-foreground" />
                                                </div>
                                            )}
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium">
                                                    {message.role === 'user' ? (user?.name || 'You') : 'ZhiLog'}
                                                </span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="text-sm text-foreground">
                                                <ReactMarkdown
                                                    remarkPlugins={[[remarkMath, { singleDollarTextMath: false }], remarkGfm]}
                                                    rehypePlugins={[rehypeKatex]}
                                                    components={{
                                                        p: (props) => <CustomCitationLink
                                                            {...props}
                                                            handleCitationClick={handleCitationClick}
                                                            messageIndex={index}
                                                            citations={message.references?.citations || []}
                                                        />,
                                                        li: (props) => <CustomCitationLink
                                                            {...props}
                                                            handleCitationClick={handleCitationClick}
                                                            messageIndex={index}
                                                            citations={message.references?.citations || []}
                                                        />,
                                                        div: (props) => <CustomCitationLink
                                                            {...props}
                                                            handleCitationClick={handleCitationClick}
                                                            messageIndex={index}
                                                            citations={message.references?.citations || []}
                                                        />,
                                                        table: (props) => (
                                                            <div className="overflow-x-auto">
                                                                <table {...props} className="min-w-full border-collapse" />
                                                            </div>
                                                        ),
                                                    }}
                                                >
                                                    {message.content}
                                                </ReactMarkdown>
                                            </div>
                                            {/* 美化后的引用区块，与overview保持一致 */}
                                            {message.references && message.references.citations?.length > 0 && (
                                                <div className="mt-2" id="references-section">
                                                    <div className="font-semibold mb-2 text-xs text-muted-foreground">References</div>
                                                    <ul className="list-none p-0">
                                                        {Object.entries(message.references.citations).map(([refIndex, value]) => (
                                                            <div
                                                                key={refIndex}
                                                                className="flex flex-row gap-2 animate-fade-in"
                                                                id={`citation-${value.key}-${index}`}
                                                            >
                                                                <div className="text-xs text-muted-foreground">
                                                                    <a href={`#citation-ref-${value.key}`}>{value.key}</a>
                                                                </div>
                                                                <div
                                                                    id={`citation-ref-${value.key}-${index}`}
                                                                    className="text-xs text-muted-foreground"
                                                                >
                                                                    {value.reference}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                                })}
                                
                                {/* Streaming indicator */}
                                {threadStreaming === thread.id && (
                                    <div className="flex gap-3 animate-fade-in">
                                        <Avatar className="h-12 w-12 flex-shrink-0 bg-transparent">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                                                <img src="/ZhiLog%20Logo%20.jpg" alt="ZhiLog" className="w-5 h-5 rounded" />
                                            </div>
                                        </Avatar>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium">ZhiLog</span>
                                                <span className="text-xs text-muted-foreground">
                                                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <Loader className="animate-spin w-4 h-4" />
                                                Thinking...
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Input for this thread */}
                                {activeThreadId === thread.id && (
                                    <div className="flex gap-2 mt-3">
                                        <Textarea
                                            ref={inputRef}
                                            value={currentInput}
                                            onChange={(e) => setCurrentInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder="Ask AI about this text..."
                                            className="modern-input flex-1 resize-none text-sm"
                                            rows={2}
                                            disabled={threadStreaming === thread.id}
                                        />
                                        <Button
                                            onClick={() => handleSendMessage(thread.id, currentInput)}
                                            disabled={!currentInput.trim() || threadStreaming === thread.id}
                                            className="gradient-button self-end"
                                            size="sm"
                                        >
                                            Send
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Collapsed state - show message count */}
                        {!thread.isExpanded && (
                            <div className="p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-muted-foreground">
                                        {thread.messages.length} messages
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => continueThread(thread.id)}
                                        className="hover:bg-muted/50"
                                    >
                                        Continue
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Global input for new threads */}
            {!activeThreadId && (
                <div className="border-t border-border/20 p-4 bg-background/80 backdrop-blur-md">
                    <div className="text-center text-sm text-muted-foreground">
                        Select text in the document to start a conversation with AI
                    </div>
                </div>
            )}
        </div>
    );
});

export default CommentStyleChat; 