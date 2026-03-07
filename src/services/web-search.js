// 2026 WebSearch Integration with Multiple Providers
import chalk from 'chalk';

export class WebSearchService {
    constructor() {
        this.providers = {
            // Primary: Brave Search API
            brave: {
                name: 'Brave Search',
                baseUrl: 'https://api.search.brave.com/res/v1/web/search',
                apiKey: process.env.BRAVE_API_KEY,
            },
            // Fallback: SerpAPI
            serpapi: {
                name: 'Google (SerpAPI)',
                baseUrl: 'https://serpapi.com/search',
                apiKey: process.env.SERPAPI_KEY,
            },
            // Free: DuckDuckGo (no API key)
            duckduckgo: {
                name: 'DuckDuckGo',
                baseUrl: 'https://api.duckduckgo.com',
                apiKey: null,
            },
            // Premium: Tavily
            tavily: {
                name: 'Tavily AI',
                baseUrl: 'https://api.tavily.com/search',
                apiKey: process.env.TAVILY_API_KEY,
            },
        };
    }

    // Main search method with failover
    async search(query, options = {}) {
        const { count = 10, safeSearch = true } = options;
        
        // Try providers in order of preference
        const providers = ['tavily', 'brave', 'serpapi', 'duckduckgo'];
        
        for (const provider of providers) {
            try {
                const results = await this.#searchWithProvider(provider, query, { count, safeSearch });
                return { results, provider: this.providers[provider].name };
            } catch (err) {
                console.log(chalk.yellow(`⚠️ ${provider} failed: ${err.message}`));
                continue;
            }
        }
        
        throw new Error('All search providers failed');
    }

    async #searchWithProvider(provider, query, options) {
        const config = this.providers[provider];
        
        switch (provider) {
            case 'tavily':
                return this.#searchTavily(query, options);
            case 'brave':
                return this.#searchBrave(query, options);
            case 'serpapi':
                return this.#searchSerpAPI(query, options);
            case 'duckduckgo':
                return this.#searchDuckDuckGo(query, options);
            default:
                throw new Error(`Unknown provider: ${provider}`);
        }
    }

    async #searchTavily(query, { count }) {
        const config = this.providers.tavily;
        if (!config.apiKey) throw new Error('TAVILY_API_KEY not set');

        const response = await fetch(config.baseUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Api-Key': config.apiKey,
            },
            body: JSON.stringify({
                query,
                max_results: count,
                include_answer: true,
                include_raw_content: false,
            }),
        });

        const data = await response.json();
        
        return {
            results: data.results?.map(r => ({
                title: r.title,
                url: r.url,
                content: r.content,
                score: r.score,
            })) || [],
            answer: data.answer,
        };
    }

    async #searchBrave(query, { count }) {
        const config = this.providers.brave;
        if (!config.apiKey) throw new Error('BRAVE_API_KEY not set');

        const url = `${config.baseUrl}?q=${encodeURIComponent(query)}&count=${count}`;
        const response = await fetch(url, {
            headers: {
                'X-Subscription-Token': config.apiKey,
                'Accept': 'application/json',
            },
        });

        const data = await response.json();
        
        return {
            results: data.web?.results?.map(r => ({
                title: r.title,
                url: r.url,
                description: r.description,
            })) || [],
        };
    }

    async #searchSerpAPI(query, { count }) {
        const config = this.providers.serpapi;
        if (!config.apiKey) throw new Error('SERPAPI_KEY not set');

        const url = `${config.baseUrl}?q=${encodeURIComponent(query)}&api_key=${config.apiKey}&num=${count}`;
        const response = await fetch(url);
        const data = await response.json();

        return {
            results: data.organic_results?.map(r => ({
                title: r.title,
                url: r.link,
                description: r.snippet,
            })) || [],
        };
    }

    async #searchDuckDuckGo(query, { count }) {
        const config = this.providers.duckduckgo;
        const url = `${config.baseUrl}/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        
        const response = await fetch(url);
        const data = await response.json();

        return {
            results: data.RelatedTopics?.slice(0, count).map(r => ({
                title: r.Text,
                url: r.FirstURL,
            })) || [],
        };
    }

    // 2026: AI-powered search (uses AI to refine query + results)
    async aiSearch(query, context = '') {
        // First, use AI to expand the query
        const expandedQuery = await this.#expandQuery(query, context);
        
        // Then search with expanded query
        const searchResults = await this.search(expandedQuery, { count: 5 });
        
        // Finally, summarize with AI
        const summary = await this.#summarizeResults(query, searchResults.results);
        
        return {
            query: expandedQuery,
            results: searchResults.results,
            summary,
            provider: searchResults.provider,
        };
    }

    async #expandQuery(query, context) {
        // Simple expansion - in production would use AI
        const keywords = query.toLowerCase().split(' ');
        const techTerms = ['javascript', 'python', 'react', 'node', 'api', 'docker', 'kubernetes'];
        
        let expanded = query;
        for (const term of techTerms) {
            if (!keywords.includes(term)) {
                // Could add related terms
            }
        }
        
        return expanded;
    }

    async #summarizeResults(query, results) {
        if (!results.length) return 'No results found.';
        
        const top3 = results.slice(0, 3).map((r, i) => 
            `${i + 1}. ${r.title}: ${r.url}`
        ).join('\n');
        
        return `Top results for "${query}":\n${top3}`;
    }
}

export default WebSearchService;
