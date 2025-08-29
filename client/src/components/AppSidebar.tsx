"use client"

import { AlertTriangle, Clock, FileText, Globe2, Home, LogOut, MessageCircleQuestion, Moon, Route, Sun, User, X, UserPlus } from "lucide-react";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { useEffect, useState } from "react";
import { fetchFromApi } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useIsDarkMode } from "@/hooks/useDarkMode";
import { useSubscription, isStorageAtLimit, isPaperUploadAtLimit, isStorageNearLimit, isPaperUploadNearLimit } from "@/hooks/useSubscription";
import Image from "next/image";
import Link from "next/link";
import { PaperStatus } from "@/components/utils/PdfStatus";

// Menu items.
const items = [
    {
        title: "Home",
        url: "/",
        icon: Home,
        requiresAuth: false,
    },
    {
        title: "Find Papers",
        url: "/finder",
        icon: Globe2,
        requiresAuth: false,
    },
    {
        title: "My Papers",
        url: "/papers",
        icon: FileText,
        requiresAuth: true,
    },
    {
        title: "Feedback",
        url: "https://zhilog.framer.website/",
        icon: MessageCircleQuestion,
        requiresAuth: false,
    }
]


export interface PaperItem {
    id: string
    title: string
    abstract?: string
    authors?: string[]
    keywords?: string[]
    institutions?: string[]
    summary?: string
    created_at?: string
    status?: PaperStatus
    preview_url?: string
    size_in_kb?: number
}

export function AppSidebar() {
    const router = useRouter();
    const { user, logout, autoLogin } = useAuth();
    const [allPapers, setAllPapers] = useState<PaperItem[]>([])
    const { darkMode, toggleDarkMode } = useIsDarkMode();
    const { subscription, loading: subscriptionLoading } = useSubscription();
    const [dismissedWarning, setDismissedWarning] = useState<string | null>(null);

    // 获取活跃论文数量
    const [activePapersCount, setActivePapersCount] = useState(0);

    useEffect(() => {
        const fetchActivePapers = async () => {
            try {
                // 使用模拟数据而不是调用失败的API
                setActivePapersCount(3); // 模拟3个活跃论文
            } catch (error) {
                console.error('Failed to fetch active papers:', error);
                setActivePapersCount(0);
            }
        };

        fetchActivePapers();
    }, []);

    const handleLogout = async () => {
        await logout();
        // 移除登录页面重定向，因为不需要认证
        // router.push('/login');
        // 可以选择重定向到主页或其他页面
        router.push('/');
    }

    // Determine current subscription warning state
    const getSubscriptionWarning = () => {
        if (!subscription || !user || subscriptionLoading) return null;

        // Check for critical states first (red warnings)
        if (isStorageAtLimit(subscription)) {
            return {
                type: 'error' as const,
                key: 'storage-limit',
                title: 'Storage limit reached',
                description: 'Upgrade your plan or delete papers to continue.',
            };
        }

        if (isPaperUploadAtLimit(subscription)) {
            return {
                type: 'error' as const,
                key: 'upload-limit',
                title: 'Upload limit reached',
                description: 'Upgrade your plan to upload more.',
            };
        }

        // Check for warning states (yellow warnings)
        if (isStorageNearLimit(subscription)) {
            return {
                type: 'warning' as const,
                key: 'storage-near-limit',
                title: 'Storage nearly full',
                description: 'Consider upgrading your plan.',
            };
        }

        if (isPaperUploadNearLimit(subscription)) {
            return {
                type: 'warning' as const,
                key: 'upload-near-limit',
                title: 'Upload limit approaching',
                description: 'Consider upgrading your plan.',
            };
        }

        return null;
    };

    const currentWarning = getSubscriptionWarning();
    const shouldShowWarning = currentWarning && dismissedWarning !== currentWarning.key;

    // Reset dismissed warning when warning changes
    useEffect(() => {
        if (currentWarning && dismissedWarning && dismissedWarning !== currentWarning.key) {
            setDismissedWarning(null);
        }
    }, [currentWarning?.key, dismissedWarning]);

    return (
        <Sidebar className="modern-sidebar">
            <SidebarContent>
                {/* Logo 区域 */}
                <SidebarGroup className="p-4">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
                            <img src="/ZhiLog%20Logo%20.jpg" alt="ZhiLog" className="w-6 h-6 rounded" />
                        </div>
                        <div>
                            <h1 className="text-lg font-bold gradient-text">ZhiLog</h1>
                            <p className="text-xs text-muted-foreground">Your AI Learning Companion</p>
                        </div>
                    </div>
                </SidebarGroup>

                {/* 主导航 */}
                <SidebarGroup>
                    <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Navigation
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {items.map((item) => (
                                <SidebarMenuItem key={item.title}>
                                    <SidebarMenuButton asChild>
                                        <Link
                                            href={item.url}
                                            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-sidebar-accent transition-colors duration-200"
                                        >
                                            <item.icon className="h-5 w-5" />
                                            <span className="font-medium">{item.title}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* 最近论文 */}
                {user && activePapersCount > 0 && (
                    <SidebarGroup>
                        <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Recent Papers
                        </SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {allPapers.slice(0, 5).map((paper) => (
                                    <SidebarMenuItem key={paper.id}>
                                        <SidebarMenuButton asChild>
                                            <Link
                                                href={`/paper/${paper.id}`}
                                                className="flex items-start gap-3 px-4 py-3 rounded-lg hover:bg-sidebar-accent transition-colors duration-200 group"
                                            >
                                                <div className="w-8 h-8 bg-gradient-to-br from-muted to-muted/80 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                                                    <FileText className="h-4 w-4 text-muted-foreground" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium truncate group-hover:text-sidebar-foreground transition-colors">
                                                        {paper.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground truncate">
                                                        {paper.authors?.slice(0, 2).join(", ")}
                                                    </p>
                                                </div>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                ))}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                )}
            </SidebarContent>

            {/* 底部用户区域 */}
            <SidebarFooter className="p-4 border-t border-sidebar-border/50">
                <div className="flex items-center justify-between">
                    {/* 用户信息 */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="ghost" className="flex items-center gap-3 w-full justify-start p-2 rounded-lg hover:bg-sidebar-accent">
                                <Avatar className="h-8 w-8">
                                    {user?.picture ? (
                                        <img
                                            src={user.picture}
                                            alt={user.name}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const avatar = e.currentTarget.closest('.h-8');
                                                const userIcon = avatar?.querySelector('.user-icon');
                                                if (userIcon) {
                                                    userIcon.classList.remove('hidden');
                                                }
                                            }}
                                        />
                                    ) : null}
                                    <User size={16} className="text-muted-foreground user-icon" />
                                </Avatar>
                                <div className="flex-1 text-left">
                                    <p className="text-sm font-medium truncate">{user?.name || "User"}</p>
                                    <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                                </div>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="modern-card w-64" align="start">
                            <div className="flex items-center gap-3 p-2">
                                <Avatar className="h-10 w-10">
                                    {user?.picture ? (
                                        <img
                                            src={user.picture}
                                            alt={user.name}
                                            onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const avatar = e.currentTarget.closest('.h-10');
                                                const userIcon = avatar?.querySelector('.user-icon-large');
                                                if (userIcon) {
                                                    userIcon.classList.remove('hidden');
                                                }
                                            }}
                                        />
                                    ) : null}
                                    <User size={24} className="text-muted-foreground user-icon-large" />
                                </Avatar>
                                <div>
                                    <p className="font-medium">{user?.name || "User"}</p>
                                    <p className="text-sm text-muted-foreground">{user?.email}</p>
                                </div>
                            </div>
                            <div className="border-t border-border/50 mt-2 pt-2">
                                <Button
                                    variant="ghost"
                                    onClick={handleLogout}
                                    className="w-full justify-start text-destructive hover:text-destructive"
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Sign Out
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* 主题切换 */}
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleDarkMode}
                        className="h-8 w-8 rounded-lg hover:bg-sidebar-accent"
                    >
                        {darkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                    </Button>
                </div>

                {/* 用户信息区域 */}
                <SidebarGroup className="mt-auto">
                    <SidebarGroupLabel className="px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        User
                    </SidebarGroupLabel>
                    <SidebarGroupContent>
                        {user ? (
                            <div className="px-4 py-3">
                                <div className="flex items-center gap-3 mb-3">
                                    <Avatar className="h-8 w-8">
                                        <AvatarImage src={user.picture} alt={user.name} />
                                        <AvatarFallback>{user.name?.charAt(0) || 'U'}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-foreground truncate">
                                            {user.name || 'Temporary User'}
                                        </p>
                                        <p className="text-xs text-muted-foreground truncate">
                                            {user.email || 'temp@example.com'}
                                        </p>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full"
                                    onClick={handleLogout}
                                >
                                    <LogOut className="h-4 w-4 mr-2" />
                                    Logout
                                </Button>
                            </div>
                        ) : (
                            <div className="px-4 py-3">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                                    <p className="text-xs text-muted-foreground">Creating account...</p>
                                </div>
                            </div>
                        )}
                    </SidebarGroupContent>
                </SidebarGroup>

                {/* 订阅警告 */}
                {subscription && !subscriptionLoading && (
                    <>
                        {isStorageAtLimit(subscription) && (
                            <Alert className="mt-3 modern-card border-destructive/20">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <AlertDescription className="text-xs">
                                    Storage limit reached. Please upgrade or delete some papers.
                                </AlertDescription>
                            </Alert>
                        )}
                        {isPaperUploadAtLimit(subscription) && (
                            <Alert className="mt-3 modern-card border-destructive/20">
                                <AlertTriangle className="h-4 w-4 text-destructive" />
                                <AlertDescription className="text-xs">
                                    Monthly upload limit reached. Please upgrade your plan.
                                </AlertDescription>
                            </Alert>
                        )}
                        {isStorageNearLimit(subscription) && !dismissedWarning?.includes('storage') && (
                            <Alert className="mt-3 modern-card border-yellow-500/20">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <AlertDescription className="text-xs">
                                    Storage nearly full. Consider upgrading.
                                </AlertDescription>
                            </Alert>
                        )}
                        {isPaperUploadNearLimit(subscription) && !dismissedWarning?.includes('upload') && (
                            <Alert className="mt-3 modern-card border-yellow-500/20">
                                <Clock className="h-4 w-4 text-yellow-500" />
                                <AlertDescription className="text-xs">
                                    Monthly upload limit approaching. Consider upgrading.
                                </AlertDescription>
                            </Alert>
                        )}
                    </>
                )}
            </SidebarFooter>
        </Sidebar>
    );
}
