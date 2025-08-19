"use client"

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { fetchFromApi, saveChatHistory, getChatHistory } from "@/lib/api";
import { Send } from "lucide-react";
import { MessageCircle } from "lucide-react";
import { ArrowRight } from "lucide-react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import 'katex/dist/katex.min.css';
import { Avatar } from "@/components/ui/avatar";
import { Loader } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { User } from "lucide-react";

interface Message {
    role: "user" | "assistant";
    content: string;
}

interface PdfOverviewChatProps {
    paperId: string;
}

export function PdfOverviewChat({ paperId }: PdfOverviewChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const { user } = useAuth();

    // 加载聊天历史
    useEffect(() => {
        const loadChatHistory = async () => {
            try {
                const history = await getChatHistory(paperId, 'overview');
                console.log('PdfOverviewChat: Loaded chat history from backend:', history);
                if (history && Array.isArray(history)) {
                    const mappedMessages = history.map(msg => {
                        console.log('PdfOverviewChat: Processing message:', { 
                            role: msg.role, 
                            message: msg.message?.substring(0, 50) + '...',
                            isUser: msg.role === 'user',
                            isAssistant: msg.role === 'assistant'
                        });
                        return {
                            role: msg.role,
                            content: msg.message
                        };
                    });
                    console.log('PdfOverviewChat: Mapped messages:', mappedMessages);
                    setMessages(mappedMessages);
                }
            } catch (error) {
                console.error("Error loading chat history:", error);
            }
        };

        if (paperId && user) {
            loadChatHistory();
        }
    }, [paperId, user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput("");
        
        // 添加用户消息到界面
        const newUserMessage = { role: "user" as const, content: userMessage };
        setMessages(prev => [...prev, newUserMessage]);
        
        // 保存用户消息到数据库
        try {
            await saveChatHistory(paperId, userMessage, 'user', 'overview');
        } catch (error) {
            console.error("Error saving user message:", error);
        }

        setIsLoading(true);

        try {
            const response = await fetchFromApi(`/api/paper/${paperId}/chat`, {
                method: "POST",
                body: JSON.stringify({
                    message: userMessage,
                    context_type: "full_text"
                })
            });

            // 添加助手消息到界面
            const newAssistantMessage = { role: "assistant" as const, content: response.message };
            setMessages(prev => [...prev, newAssistantMessage]);
            
            // 保存助手消息到数据库
            try {
                await saveChatHistory(paperId, response.message, 'assistant', 'overview');
            } catch (error) {
                console.error("Error saving assistant message:", error);
            }
        } catch (error) {
            console.error("Error sending message:", error);
            const errorMessage = { 
                role: "assistant" as const, 
                content: "Sorry, an error occurred while processing your request. Please try again." 
            };
            setMessages(prev => [...prev, errorMessage]);
            
            // 保存错误消息到数据库
            try {
                await saveChatHistory(paperId, errorMessage.content, 'assistant', 'overview');
            } catch (saveError) {
                console.error("Error saving error message:", saveError);
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-gradient-to-b from-background/50 via-background/30 to-background/50 backdrop-blur-sm rounded-xl border border-border/20 overflow-hidden modern-shadow">
            {/* 消息区域 */}
            <ScrollArea className="flex-1 px-6">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-8">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center backdrop-blur-sm">
                            <MessageCircle className="h-10 w-10 text-primary" />
                        </div>
                        <div className="max-w-sm space-y-4">
                            <h3 className="font-semibold text-2xl gradient-text">Paper Assistant</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                I can help you understand this paper. Feel free to ask me any questions about it.
                            </p>
                            <div className="modern-card p-6 space-y-3">
                                <p className="font-medium text-sm text-foreground">Try these questions:</p>
                                <ul className="space-y-3">
                                    <li 
                                        className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all duration-200 border border-primary/20"
                                        onClick={() => {
                                            setInput("What are the main contributions of this paper?");
                                            setTimeout(() => handleSubmit(new Event("click") as any), 100);
                                        }}
                                    >
                                        <ArrowRight className="h-4 w-4 text-primary" />
                                        <span className="text-sm text-foreground">What are the main contributions of this paper?</span>
                                    </li>
                                    <li 
                                        className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all duration-200 border border-primary/20"
                                        onClick={() => {
                                            setInput("What research methods were used?");
                                            setTimeout(() => handleSubmit(new Event("click") as any), 100);
                                        }}
                                    >
                                        <ArrowRight className="h-4 w-4 text-primary" />
                                        <span className="text-sm text-foreground">What research methods were used?</span>
                                    </li>
                                    <li 
                                        className="flex items-center space-x-3 p-3 rounded-lg cursor-pointer bg-gradient-to-r from-primary/10 to-primary/5 hover:from-primary/20 hover:to-primary/10 transition-all duration-200 border border-primary/20"
                                        onClick={() => {
                                            setInput("What were the experimental results?");
                                            setTimeout(() => handleSubmit(new Event("click") as any), 100);
                                        }}
                                    >
                                        <ArrowRight className="h-4 w-4 text-primary" />
                                        <span className="text-sm text-foreground">What were the experimental results?</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 py-6">
                        {messages.map((message, i) => (
                            <div
                                key={i}
                                className={`flex ${
                                    message.role === "assistant" ? "justify-start" : "justify-end"
                                } items-end space-x-2 animate-fade-in`}
                            >
                                {message.role === "assistant" && (
                                    <Avatar className="h-12 w-12 flex-shrink-0 bg-transparent">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-lg">
                                            <img src="/ZhiLog%20Logo%20.jpg" alt="ZhiLog" className="w-5 h-5 rounded" />
                                        </div>
                                    </Avatar>
                                )}
                                {message.role === "user" && (
                                    <Avatar className="h-12 w-12 flex-shrink-0 bg-transparent">
                                        {user?.picture ? (
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
                                        )}
                                        {user?.picture && (
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center shadow-lg user-icon hidden">
                                                <User size={16} className="text-muted-foreground" />
                                            </div>
                                        )}
                                    </Avatar>
                                )}
                                <div
                                    className={`inline-block max-w-[80%] rounded-2xl px-4 py-3 shadow-lg backdrop-blur-sm ${
                                        message.role === "assistant"
                                            ? "bg-card/80 border border-border/20 text-card-foreground"
                                            : "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
                                    }`}
                                >
                                    {message.role === "assistant" ? (
                                        <div className="prose prose-sm max-w-none">
                                            <Markdown
                                                remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                                                rehypePlugins={[rehypeKatex]}
                                                components={{
                                                    h1: ({node, ...props}) => <h1 className="text-lg font-bold mb-2" {...props} />,
                                                    h2: ({node, ...props}) => <h2 className="text-base font-semibold mb-2" {...props} />,
                                                    ul: ({node, ...props}) => <ul className="list-disc list-inside mb-2" {...props} />,
                                                    ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-2" {...props} />,
                                                    a: ({node, ...props}) => <a className="text-primary hover:underline" {...props} />,
                                                    code: ({node, ...props}) => <code className="bg-muted rounded px-1" {...props} />,
                                                    blockquote: ({node, ...props}) => (
                                                        <blockquote className="border-l-4 border-primary pl-4 italic my-2" {...props} />
                                                    ),
                                                }}
                                            >
                                                {message.content}
                                            </Markdown>
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                                            {message.content}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                        {/* Loading indicator */}
                        {isLoading && (
                            <div className="flex gap-3 items-start animate-fade-in">
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
                    </div>
                )}
            </ScrollArea>

            {/* 输入区域 */}
            <div className="p-4 bg-background/80 backdrop-blur-md border-t border-border/20">
                <form onSubmit={handleSubmit} className="flex gap-2 items-center">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask about the paper..."
                        disabled={isLoading}
                        className="modern-input flex-1"
                    />
                    <Button 
                        type="submit" 
                        disabled={isLoading}
                        size="icon"
                        className="gradient-button w-12 h-12 rounded-xl"
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </form>
            </div>
        </div>
    );
} 