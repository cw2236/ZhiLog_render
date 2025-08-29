import { useState, useEffect, useCallback } from 'react';
// import { fetchFromApi } from '@/lib/api'; // 注释掉API调用

export interface SubscriptionLimits {
    paper_uploads: number;
    knowledge_base_size: number;
    chat_credits_daily: number;
    audio_overviews_monthly: number;
    model: string[];
}

export interface SubscriptionUsage {
    paper_uploads: number;
    paper_uploads_remaining: number;
    knowledge_base_size: number;
    knowledge_base_size_remaining: number;
    chat_credits_used: number;
    chat_credits_remaining: number;
    audio_overviews_used: number;
    audio_overviews_remaining: number;
}

export interface SubscriptionData {
    plan: 'basic' | 'researcher';
    limits: SubscriptionLimits;
    usage: SubscriptionUsage;
}

export interface UseSubscriptionReturn {
    subscription: SubscriptionData | null;
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
}

export const useSubscription = (): UseSubscriptionReturn => {
    // 返回模拟的订阅数据，避免API调用失败
    const mockSubscription: SubscriptionData = {
        plan: 'researcher',
        limits: {
            paper_uploads: 100,
            knowledge_base_size: 1000,
            chat_credits_daily: 1000,
            audio_overviews_monthly: 50,
            model: ['gpt-4', 'claude-3']
        },
        usage: {
            paper_uploads: 0,
            paper_uploads_remaining: 100,
            knowledge_base_size: 0,
            knowledge_base_size_remaining: 1000,
            chat_credits_used: 0,
            chat_credits_remaining: 1000,
            audio_overviews_used: 0,
            audio_overviews_remaining: 50
        }
    };

    return {
        subscription: mockSubscription,
        loading: false,
        error: null,
        refetch: async () => {
            // 模拟的refetch函数，不做任何操作
            console.log('Mock subscription refetch called');
        }
    };
};

// Helper functions for common subscription checks
export const getStorageUsagePercentage = (subscription: SubscriptionData | null): number => {
    if (!subscription) return 0;
    const { knowledge_base_size, knowledge_base_size_remaining } = subscription.usage;
    const total = knowledge_base_size + knowledge_base_size_remaining;
    if (total === 0) return 0;
    return (knowledge_base_size / total) * 100;
};

export const isStorageNearLimit = (subscription: SubscriptionData | null, threshold: number = 75): boolean => {
    return getStorageUsagePercentage(subscription) >= threshold;
};

export const isStorageAtLimit = (subscription: SubscriptionData | null): boolean => {
    return getStorageUsagePercentage(subscription) >= 100;
};

export const getPaperUploadPercentage = (subscription: SubscriptionData | null): number => {
    if (!subscription) return 0;
    const { paper_uploads, paper_uploads_remaining } = subscription.usage;
    const total = paper_uploads + paper_uploads_remaining;
    if (total === 0) return 0;
    return (paper_uploads / total) * 100;
};

export const isPaperUploadNearLimit = (subscription: SubscriptionData | null, threshold: number = 75): boolean => {
    return getPaperUploadPercentage(subscription) >= threshold;
};

export const isPaperUploadAtLimit = (subscription: SubscriptionData | null): boolean => {
    return getPaperUploadPercentage(subscription) >= 100;
};

export const formatFileSize = (sizeInKb: number): string => {
    if (sizeInKb < 1024) {
        return `${sizeInKb.toFixed(1)} KB`;
    } else if (sizeInKb < 1024 * 1024) {
        return `${(sizeInKb / 1024).toFixed(1)} MB`;
    } else {
        return `${(sizeInKb / (1024 * 1024)).toFixed(1)} GB`;
    }
};

// Audio overview credit helper functions
export const getAudioOverviewUsagePercentage = (subscription: SubscriptionData | null): number => {
    if (!subscription) return 0;
    const { audio_overviews_used: audio_overviews, audio_overviews_remaining } = subscription.usage;
    const total = audio_overviews + audio_overviews_remaining;
    if (total === 0) return 0;
    return (audio_overviews / total) * 100;
};

export const isAudioOverviewNearLimit = (subscription: SubscriptionData | null, threshold: number = 75): boolean => {
    return getAudioOverviewUsagePercentage(subscription) >= threshold;
};

export const isAudioOverviewAtLimit = (subscription: SubscriptionData | null): boolean => {
    return getAudioOverviewUsagePercentage(subscription) >= 100;
};

// Calculate next Monday at 12 AM UTC for credit reset
export const nextMonday = (() => {
    const now = new Date();
    const currentDayUTC = now.getUTCDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const daysUntilMonday = currentDayUTC === 0 ? 1 : (8 - currentDayUTC) % 7; // Days until next Monday
    const nextMondayUTC = new Date(now.getTime() + daysUntilMonday * 24 * 60 * 60 * 1000);

    // Set to start of day in UTC (00:00:00 UTC)
    nextMondayUTC.setUTCHours(0, 0, 0, 0);

    return nextMondayUTC;
})();
