import { useEffect, useState, useCallback } from "react";
import { getFuzzyMatchingNodesInPdf, getMatchingNodesInPdf } from "../utils/PdfTextUtils";

export function usePdfSearch(explicitSearchTerm?: string) {
    const [searchText, setSearchText] = useState(explicitSearchTerm || "");
    const [searchResults, setSearchResults] = useState<number[]>([]);
    const [currentMatch, setCurrentMatch] = useState(-1);
    const [notFound, setNotFound] = useState(false);

    // 当 explicitSearchTerm 改变时更新搜索文本
    useEffect(() => {
        if (explicitSearchTerm) {
            setSearchText(explicitSearchTerm);
            performSearch();
        }
    }, [explicitSearchTerm]);

    const performSearch = useCallback(() => {
        console.log('Performing search with text:', searchText);
        
        const textNodes = document.querySelectorAll('.react-pdf__Page__textContent');
        const results: number[] = [];

        textNodes.forEach((node, pageIndex) => {
            const text = node.textContent || '';
            if (text.toLowerCase().includes(searchText.toLowerCase())) {
                results.push(pageIndex);
                console.log('Found match on page:', pageIndex + 1);
            }
        });

        if (results.length > 0) {
            setSearchResults(results);
            setCurrentMatch(0);
            setNotFound(false);

            // 滚动到第一个匹配项
            const firstMatch = results[0];
            const pageElement = document.querySelector(`[data-page-number="${firstMatch + 1}"]`);
            pageElement?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
            setSearchResults([]);
            setCurrentMatch(-1);
            setNotFound(true);
            console.log('No matches found');
        }
    }, [searchText]);

    const handleClearSearch = () => {
        setSearchText("");
        setSearchResults([]);
        setCurrentMatch(-1);
        setNotFound(false);
        // Remove styling from any existing search highlights
        const pdfTextElements = document.querySelectorAll('.react-pdf__Page__textContent span.bg-yellow-100');
        pdfTextElements.forEach(span => {
            if (span.classList.contains('bg-blue-100')) return; // Don't remove user highlight formatting
            span.classList.remove('bg-yellow-100', 'rounded', 'opacity-20');
        });
    };

    const scrollToMatch = (match: { pageIndex: number; matchIndex: number; nodes: Element[] }) => {
        if (!match) return;

        // Get the page div from the document
        const pageDiv = document.querySelectorAll('.react-pdf__Page')[match.pageIndex];

        // If the we are already on the page, do not scroll
        if (pageDiv && pageDiv.classList.contains('react-pdf__Page--active')) {
            // Scroll to the first matching node
            if (match.nodes.length > 0) {
                match.nodes[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        if (!pageDiv) return;

        // Scroll to the page
        pageDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Remove styling from any existing highlights
        const pdfTextElements = document.querySelectorAll('.react-pdf__Page__textContent span.bg-yellow-100');
        pdfTextElements.forEach(span => {
            if (span.classList.contains('bg-blue-100')) return;
            span.classList.remove('bg-yellow-100', 'rounded', 'opacity-40');
        });

        // Highlight all nodes that contain parts of the match
        setTimeout(() => {
            match.nodes.forEach(node => {
                if (node.classList.contains('bg-blue-100')) return;
                node.classList.add('bg-yellow-100', 'rounded', 'opacity-40');
            });

            // Scroll to the first matching node
            if (match.nodes.length > 0) {
                match.nodes[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 100);
    };

    const goToNextMatch = () => {
        if (searchResults.length === 0) return;

        const nextMatch = (currentMatch + 1) % searchResults.length;
        setCurrentMatch(nextMatch);
        const pageIndex = searchResults[nextMatch];
        scrollToMatch({ pageIndex, matchIndex: 0, nodes: [] });
    };

    const goToPreviousMatch = () => {
        if (searchResults.length === 0) return;

        const prevMatch = (currentMatch - 1 + searchResults.length) % searchResults.length;
        setCurrentMatch(prevMatch);
        const pageIndex = searchResults[prevMatch];
        scrollToMatch({ pageIndex, matchIndex: 0, nodes: [] });
    };

    return {
        searchText,
        setSearchText,
        searchResults,
        currentMatch,
        notFound,
        performSearch,
        goToNextMatch,
        goToPreviousMatch,
        setSearchResults,
        setNotFound,
        setCurrentMatch,
        handleClearSearch,
    };
}
