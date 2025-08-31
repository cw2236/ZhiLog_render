"use client";

import { Button } from "@/components/ui/button";
import { useState, useEffect, useMemo, useRef } from "react";
import { fetchFromApi } from "@/lib/api";
import { useIsMobile } from "@/lib/useMobile";;
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { FileText, Loader2, MessageCircleWarning, UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { PdfDropzone } from "@/components/PdfDropzone";
import Link from "next/link";
import EnigmaticLoadingExperience from "@/components/EnigmaticLoadingExperience";
import { PaperItem } from "@/components/AppSidebar";
import PaperCard from "@/components/PaperCard";
import { JobStatusType } from "@/lib/schema";
import OpenPaperLanding from "@/components/OpenPaperLanding";
import { toast } from "sonner";
import { useSubscription, isStorageAtLimit, isPaperUploadAtLimit, isPaperUploadNearLimit, isStorageNearLimit } from "@/hooks/useSubscription";
import ErrorBoundary from '@/components/ErrorBoundary';

interface PdfUploadResponse {
	message: string;
	job_id: string;
}

interface JobStatusResponse {
	job_id: string;
	status: JobStatusType;
	started_at: string;
	completed_at: string | null;
	paper_id: string | null;
	has_file_url: boolean;
	has_metadata: boolean;
	celery_progress_message: string | null;
}

const DEFAULT_PAPER_UPLOAD_ERROR_MESSAGE = "We encountered an error processing your request. Please check the file or URL and try again.";

export default function Home() {
	const [isUploading, setIsUploading] = useState(false);
	const [isUrlDialogOpen, setIsUrlDialogOpen] = useState(false);

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const [jobUploadStatus, setJobUploadStatus] = useState<JobStatusType | null>(null);

	const [pdfUrl, setPdfUrl] = useState("");
	const [relevantPapers, setRelevantPapers] = useState<PaperItem[]>([]);
	const [showErrorAlert, setShowErrorAlert] = useState(false);
	const [errorAlertMessage, setErrorAlertMessage] = useState(DEFAULT_PAPER_UPLOAD_ERROR_MESSAGE);
	const [showPricingOnError, setShowPricingOnError] = useState(false);

	const { user, loading: authLoading, autoLogin } = useAuth();
	const { subscription, loading: subscriptionLoading } = useSubscription();
	const isMobile = useIsMobile();

	// Toast notifications for subscription limits
	useEffect(() => {
		if (!subscriptionLoading && subscription && user) {
			// Check for at-limit conditions (error styling)
			if (isStorageAtLimit(subscription)) {
				toast.error("Storage limit reached", {
					description: "You've reached your storage limit. Please upgrade your plan or delete some papers to continue.",
					action: {
						label: "Upgrade",
						onClick: () => window.location.href = "/pricing"
					},
				});
			} else if (isPaperUploadAtLimit(subscription)) {
				toast.error("Upload limit reached", {
					description: "You've reached your paper upload limit for this month. Please upgrade your plan to upload more papers.",
					action: {
						label: "Upgrade",
						onClick: () => window.location.href = "/pricing"
					},
				});
			}
			// Check for near-limit conditions (warning styling)
			else if (isStorageNearLimit(subscription)) {
				toast.warning("Storage nearly full", {
					description: "You're approaching your storage limit. Consider upgrading your plan or managing your papers.",
					action: {
						label: "Plans",
						onClick: () => window.location.href = "/pricing"
					},
				});
			} else if (isPaperUploadNearLimit(subscription)) {
				toast.warning("Upload limit approaching", {
					description: "You're approaching your monthly paper upload limit. Consider upgrading your plan.",
					action: {
						label: "Plans",
						onClick: () => window.location.href = "/pricing"
					},
				});
			}
		}
	}, [subscription, subscriptionLoading, user]);

	// New state for loading experience
	const [elapsedTime, setElapsedTime] = useState(0);
	const [messageIndex, setMessageIndex] = useState(0);
	const [fileSize, setFileSize] = useState<number | null>(null);
	const [fileLength, setFileLength] = useState<string | null>(null);
	const [displayedMessage, setDisplayedMessage] = useState("");
	const [celeryMessage, setCeleryMessage] = useState<string | null>(null);

	// Ref to access latest celeryMessage value in intervals
	const celeryMessageRef = useRef<string | null>(null);

	// Keep ref in sync with state
	useEffect(() => {
		celeryMessageRef.current = celeryMessage;
	}, [celeryMessage]);


	const loadingMessages = useMemo(() => [
		`Processing ${fileLength ? fileLength : 'lots of'} characters`,
		`Processing ${fileSize ? (fileSize / 1024 / 1024).toFixed(2) + 'mb' : '...'} `,
		"Uploading to the cloud",
		"Extracting metadata",
		"Crafting grounded citations",
	], [fileLength, fileSize]);

	// Effect for timer and message cycling
	useEffect(() => {
		let timer: NodeJS.Timeout | undefined;
		let messageTimer: NodeJS.Timeout | undefined;

		if (isUploading) {

			setElapsedTime(0);
			setMessageIndex(0);

			timer = setInterval(() => {
				setElapsedTime((prevTime) => prevTime + 1);
			}, 1000);

			messageTimer = setInterval(() => {
				// Check if celery message is set using ref
				if (celeryMessageRef.current) {
					// Clear the message timer if celery message is available
					if (messageTimer) {
						clearInterval(messageTimer);
						messageTimer = undefined;
					}
					return;
				}

				setMessageIndex((prevIndex) => {
					if (prevIndex < loadingMessages.length - 1) {
						return prevIndex + 1;
					}
					return prevIndex;
				});
			}, 8000);
		}

		return () => {
			if (timer) clearInterval(timer);
			if (messageTimer) clearInterval(messageTimer);
		};
	}, [isUploading, fileSize, loadingMessages]);

	// Typewriter effect
	useEffect(() => {
		setDisplayedMessage("");
		let i = 0;
		const typingTimer = setInterval(() => {
			// Use celery message if available, otherwise use the cycling message
			const currentMessage = celeryMessage || loadingMessages[messageIndex];
			if (i < currentMessage.length) {
				setDisplayedMessage(currentMessage.slice(0, i + 1));
				i++;
			} else {
				clearInterval(typingTimer);
			}
		}, 50);

		return () => clearInterval(typingTimer);
	}, [messageIndex, loadingMessages, celeryMessage]);


	// Poll job status
	const pollJobStatus = async (jobId: string) => {
		try {
			const response: JobStatusResponse = await fetchFromApi(`/api/paper/upload/status/${jobId}`);
			setJobUploadStatus(response.status);

			// Update celery message if available
			if (response.celery_progress_message) {
				setCeleryMessage(response.celery_progress_message);
			}

			if (response.status === 'completed' && response.paper_id) {

				// Success - redirect to paper
				const redirectUrl = new URL(`/paper/${response.paper_id}`, window.location.origin);
				setTimeout(() => {
					window.location.href = redirectUrl.toString();
				}, 500);

			} else if (response.status === 'failed') {
				// Failed - show error
				console.error('Upload job failed');
				setShowErrorAlert(true);
				setIsUploading(false);
				setJobUploadStatus(null);
			} else {
				// Still processing - poll again
				setTimeout(() => pollJobStatus(jobId), 2000);
			}
		} catch (error) {
			console.error('Error polling job status:', error);
			setShowErrorAlert(true);
			setIsUploading(false);
		}
	};

	useEffect(() => {
		if (!user) return;

		// Define an async function inside useEffect
		const fetchPapers = async () => {
			try {
				const response = await fetchFromApi("/api/paper/relevant");
				const sortedPapers = response.papers.sort((a: PaperItem, b: PaperItem) => {
					return new Date(b.created_at || "").getTime() - new Date(a.created_at || "").getTime();
				});
				setRelevantPapers(sortedPapers);
			} catch (error) {
				console.error("Error fetching papers:", error);
				setRelevantPapers([]);
			}
		}

		// Call the async function
		fetchPapers();
	}, [user]);


	const handleFileUpload = async (file: File) => {
		console.log('=== UPLOAD DEBUG START ===');
		console.log('Starting file upload:', { fileName: file.name, fileSize: file.size });
		console.log('Current user:', user);
		console.log('User ID:', user?.id);
		console.log('User email:', user?.email);
		console.log('User active:', user?.is_active);
		
		// 检查localStorage
		const storedUser = localStorage.getItem('auth_user');
		console.log('Stored user in localStorage:', storedUser);
		
		// 检查cookies
		console.log('All cookies:', document.cookie);
		const sessionCookie = document.cookie.split(';').find(c => c.trim().startsWith('session='));
		console.log('Session cookie:', sessionCookie);
		
		if (!user) {
			console.error('No user found, cannot upload');
			toast.error("Please log in to upload papers");
			return;
		}

		// Check file size
		if (file.size > 10 * 1024 * 1024) { // 10MB
			toast.error("File size must be less than 10MB");
			return;
		}

		setIsUploading(true);
		setFileSize(file.size);
		setCeleryMessage(null); // Reset celery message

		file.text().then(text => {
			setFileLength(text.length.toString());
		}).catch(err => {
			console.error('Error reading file text:', err);
			setFileLength('lots of');
		});

		const formData = new FormData();
		formData.append('file', file);

		try {
			const response: PdfUploadResponse = await fetchFromApi('/api/paper/upload/', {
				method: 'POST',
				body: formData,
				headers: {
					Accept: 'application/json',
				},
			});

			// Start polling job status
			pollJobStatus(response.job_id);
		} catch (error) {
			console.error('Error uploading file:', error);
			console.log('=== UPLOAD DEBUG END WITH ERROR ===');
			setShowErrorAlert(true);
			setErrorAlertMessage(error instanceof Error ? error.message : DEFAULT_PAPER_UPLOAD_ERROR_MESSAGE);
			if (error instanceof Error && error.message.includes('upgrade') && error.message.includes('upload limit')) {
				setShowPricingOnError(true);
			} else {
				setShowPricingOnError(false);
			}
			setIsUploading(false);
		}
	};

	const handlePdfUrl = async (url: string) => {
		setIsUploading(true);
		setFileSize(null);
		setCeleryMessage(null); // Reset celery message
		try {
			const response = await fetch(url, {
				method: 'GET',
			});

			// Check if the response is OK
			if (!response.ok) throw new Error('Failed to fetch PDF');

			const contentDisposition = response.headers.get('content-disposition');
			const randomFilename = Math.random().toString(36).substring(2, 15) + '.pdf';
			let filename = randomFilename;

			if (contentDisposition && contentDisposition.includes('attachment')) {
				const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
				const matches = filenameRegex.exec(contentDisposition);
				if (matches != null && matches[1]) {
					filename = matches[1].replace(/['"]/g, '');
				}
			} else {
				const urlParts = url.split('/');
				const urlFilename = urlParts[urlParts.length - 1];
				if (urlFilename && urlFilename.toLowerCase().endsWith('.pdf')) {
					filename = urlFilename;
				}
			}

			const blob = await response.blob();
			const file = new File([blob], filename, { type: 'application/pdf' });

			await handleFileUpload(file);
		} catch (error) {
			console.log('Client-side fetch failed, trying server-side fetch...', error);

			try {
				// Fallback to server-side fetch
				const response: PdfUploadResponse = await fetchFromApi('/api/paper/upload/from-url/', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({ url }),
				});

				// Start polling job status
				pollJobStatus(response.job_id);

			} catch (serverError) {
				console.error('Both client and server-side fetches failed:', serverError);
				setShowErrorAlert(true);
				setIsUploading(false);
			}
		}
	};

	const handleLinkClick = () => {
		setIsUrlDialogOpen(true);
	};

	const handleDialogConfirm = async () => {
		if (pdfUrl) {
			await handlePdfUrl(pdfUrl);
		}
		setIsUrlDialogOpen(false);
		setPdfUrl("");
	};

	if (authLoading) {
		// Maybe show a loading spinner or skeleton
		return null;
	}

	// 移除自动登录提示，直接显示上传功能
	// if (!authLoading && !user) {
	// 	return (
	// 		<div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] p-4">
	// 			<div className="text-center max-w-md">
	// 				<div className="mx-auto mb-6 rounded-full bg-blue-100 p-3 text-blue-600">
	// 					<UserPlus className="h-12 w-12" />
	// 				</div>
	// 				<h2 className="text-2xl font-bold mb-4">Welcome to Open Paper</h2>
	// 				<p className="text-muted-foreground mb-6">
	// 					Click the button below to automatically create a temporary account for testing.
	// 				</p>
	// 				<Button onClick={autoLogin} size="lg" className="w-full">
	// 					<UserPlus className="h-4 w-4 mr-2" />
	// 					Start Testing
	// 				</Button>
	// 				<p className="text-xs text-muted-foreground mt-4">
	// 					This creates a temporary account that will be stored in your browser cookies.
	// 				</p>
	// 			</div>
	// 		</div>
	// 	);
	// }

	// 如果没有用户，自动创建一个临时用户（静默创建）
	if (!authLoading && !user) {
		// 自动创建用户，不显示提示
		useEffect(() => {
			autoLogin();
		}, []);
	}

	if (!user && !authLoading) {
		return (
			<OpenPaperLanding />
		);
	}

	return (
		<ErrorBoundary>
			<div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
				<main className="container mx-auto px-6 py-12 max-w-7xl">
					{/* 头部区域 */}
					<div className="text-center mb-16 animate-fade-in">
						<div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl shadow-lg mb-6">
							<FileText className="h-10 w-10 text-primary-foreground" />
						</div>
						<h1 className="text-5xl font-bold mb-4 gradient-text">
							ZhiLog
						</h1>
						<p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
							Your AI Paper Reading Assistant for Efficient Academic Research
						</p>
					</div>

					{/* 移动端提示 */}
					{isMobile && (
						<Dialog open={true}>
							<DialogContent className="modern-card">
								<DialogHeader>
									<DialogTitle className="gradient-text">ZhiLog</DialogTitle>
									<DialogDescription>
										This app is optimized for desktop devices. Please use a computer or tablet for the best experience.
									</DialogDescription>
								</DialogHeader>
							</DialogContent>
						</Dialog>
					)}

					{/* 上传区域 */}
					<div className="max-w-4xl mx-auto mb-16">
						<div className="text-center mb-8">
							<h2 className="text-2xl font-semibold mb-3">Start Your Academic Journey</h2>
							<p className="text-muted-foreground">
								Upload papers and let the AI assistant help you deeply understand research content
							</p>
						</div>

						{/* 现代化上传组件 */}
						<div className="modern-card p-8">
							<PdfDropzone
								onFileSelect={handleFileUpload}
								onUrlClick={handleLinkClick}
								maxSizeMb={10}
							/>
						</div>
					</div>

					{/* 最近论文区域 */}
					{relevantPapers.length > 0 && (
						<div className="animate-slide-in">
							{/* 分隔线 */}
							<div className="flex items-center justify-center mb-12">
								<div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
								<div className="px-6">
									<h2 className="text-2xl font-semibold gradient-text">Continue Reading</h2>
								</div>
								<div className="flex-1 h-px bg-gradient-to-r from-transparent via-border to-transparent"></div>
							</div>

							{/* 论文网格 */}
							<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
								{relevantPapers.map((paper) => (
									<div key={paper.id} className="modern-card p-6 hover:scale-105 transition-transform duration-300">
										<PaperCard
											paper={paper}
											setPaper={(paperId: string, updatedPaper: PaperItem) => {
												setRelevantPapers((prev) =>
													prev.map((p) => (p.id === paperId ? { ...p, ...updatedPaper } : p))
												);
											}}
										/>
									</div>
								))}
							</div>

							{/* 查看全部按钮 */}
							<div className="text-center mt-8">
								<Button variant="outline" size="lg" asChild className="modern-card">
									<Link href="/papers" className="flex items-center gap-2">
										<FileText className="h-4 w-4" />
										View All Papers
									</Link>
								</Button>
							</div>
						</div>
					)}

					{/* 底部区域 */}
					{relevantPapers.length === 0 && (
						<footer className="text-center mt-20 animate-fade-in">
							<div className="modern-card p-8 max-w-md mx-auto">
								<p className="text-muted-foreground mb-4">
									Made with ❤️ in San Francisco
								</p>
								<div className="flex gap-4 justify-center">
									<Button size="lg" variant="outline" asChild className="modern-card">
										<Link href="/blog/manifesto">
											<FileText className="h-4 w-4 mr-2" />
											Manifesto
										</Link>
									</Button>
									<Button size="lg" variant="outline" asChild className="modern-card">
										<a
											href="https://github.com/khoj-ai/openpaper"
											target="_blank"
											rel="noopener noreferrer"
											className="flex items-center gap-2"
										>
											<svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
												<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
											</svg>
											GitHub
										</a>
									</Button>
								</div>
							</div>
						</footer>
					)}
				</main>

				{/* 错误对话框 */}
				{showErrorAlert && (
					<Dialog open={showErrorAlert} onOpenChange={setShowErrorAlert}>
						<DialogContent className="modern-card">
							<DialogTitle className="gradient-text">Upload Failed</DialogTitle>
							<DialogDescription className="space-y-4 inline-flex items-center">
								<MessageCircleWarning className="h-6 w-6 text-destructive mr-2 flex-shrink-0" />
								{errorAlertMessage ?? DEFAULT_PAPER_UPLOAD_ERROR_MESSAGE}
							</DialogDescription>
							<div className="flex justify-end mt-4">
								{showPricingOnError && (
									<Button variant="default" asChild className="gradient-button mr-2">
										<Link href="/pricing">Upgrade</Link>
									</Button>
								)}
							</div>
						</DialogContent>
					</Dialog>
				)}

				{/* PDF URL 对话框 */}
				<Dialog open={isUrlDialogOpen} onOpenChange={setIsUrlDialogOpen}>
					<DialogContent className="modern-card">
						<DialogHeader>
							<DialogTitle className="gradient-text">Import PDF from URL</DialogTitle>
							<DialogDescription>
								Enter the public URL of the PDF you want to upload.
							</DialogDescription>
						</DialogHeader>
						<Input
							type="url"
							placeholder="https://arxiv.org/pdf/1706.03762v7"
							value={pdfUrl}
							onChange={(e) => setPdfUrl(e.target.value)}
							className="modern-input mt-4"
						/>
						<div className="flex justify-end gap-2 mt-4">
							<Button variant="secondary" onClick={() => setIsUrlDialogOpen(false)} className="modern-card">
								Cancel
							</Button>
							<Button onClick={handleDialogConfirm} disabled={!pdfUrl || isUploading} className="gradient-button">
								{isUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
								Submit
							</Button>
						</div>
					</DialogContent>
				</Dialog>

				{/* 上传进度对话框 */}
				<Dialog open={isUploading} onOpenChange={(open) => !open && setIsUploading(false)}>
					<DialogContent className="modern-card sm:max-w-md" hideCloseButton>
						<DialogHeader>
							<DialogTitle className="text-center gradient-text">Processing Your Paper</DialogTitle>
							<DialogDescription className="text-center">
								This might take up to two minutes...
							</DialogDescription>
						</DialogHeader>
						<div className="flex flex-col items-center justify-center py-8 space-y-6 w-full">
							<EnigmaticLoadingExperience />
							<div className="flex items-center justify-center gap-1 font-mono text-lg w-full">
								<div className="flex items-center gap-1 w-14">
									<Loader2 className="h-6 w-6 animate-spin text-primary" />
									<p className="text-muted-foreground w-12">
										{elapsedTime}s
									</p>
								</div>
								<p className="text-primary text-right flex-1">{displayedMessage}</p>
							</div>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</ErrorBoundary>
	);
}
