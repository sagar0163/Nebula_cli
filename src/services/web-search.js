// 2026 WebSearch - Simplified for CLI use
export class WebSearchService {
    constructor() {
        // Just one free option - no API keys needed
    }

    async search(query, options = {}) {
        const { count = 5 } = options;
        
        // Use DuckDuckGo (free, no API key)
        try {
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&limit=${count}`;
            const response = await fetch(url);
            const data = await response.json();

            return {
                results: (data.RelatedTopics || []).slice(0, count).map(r => ({
                    title: r.Text,
                    url: r.FirstURL,
                })),
                provider: 'DuckDuckGo',
            };
        } catch (err) {
            throw new Error(`Search failed: ${err.message}`);
        }
    }
}

export default WebSearchService;
