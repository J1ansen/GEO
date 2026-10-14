# AI Bots List — User-Agents for robots.txt

> Last updated: February 2026  
> Source: server log analysis, official vendor documentation, Momentic Marketing (Feb 2026)

## Recommended Full robots.txt

Copy this block into your `robots.txt` to optimize AI access:

```
# ═══════════════════════════════════════════════
#   AI SEARCH & CITATION BOTS — Allow All
#   GEO-Optimized robots.txt
#   Updated: 2026-02
# ═══════════════════════════════════════════════

# ——— OpenAI ———
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /

# ——— Anthropic (Claude) ———
User-agent: anthropic-ai
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: claude-web
Allow: /

# ——— Perplexity ———
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /

# ——— Google AI (Gemini) ———
User-agent: Google-Extended
Allow: /

# ——— Microsoft (Copilot/Bing) ———
User-agent: Bingbot
Allow: /

# ——— Apple (Siri/AI) ———
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /

# ——— Meta (AI) ———
User-agent: FacebookBot
Allow: /
User-agent: meta-externalagent
Allow: /

# ——— ByteDance/TikTok ———
User-agent: Bytespider
Allow: /

# ——— DuckDuckGo AI ———
User-agent: DuckAssistBot
Allow: /

# ——— Cohere ———
User-agent: cohere-ai
Allow: /

# ——— Academic / Open ———
User-agent: AI2Bot
Allow: /
User-agent: CCBot
Allow: /

# ——— Traditional (always keep) ———
User-agent: Googlebot
Allow: /
User-agent: *
Allow: /

Sitemap: https://yoursite.com/sitemap.xml
```

---

## Full List by Category

### OpenAI (ChatGPT)

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `GPTBot` | Training | Crawl for OpenAI model training | ⚠️ Training only |
| `OAI-SearchBot` | Search | **ChatGPT Search citations** — critical! | 🔴 CRITICAL |
| `ChatGPT-User` | On-demand | Fetch pages when user asks | ⭐⭐⭐ |

**robots.txt snippet:**
```
User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
```

**Notes:**
- `OAI-SearchBot` = the bot that decides whether to cite you in ChatGPT Search
- `GPTBot` = training data. You can block training but allow citations:
  ```
  User-agent: GPTBot
  Disallow: /
  User-agent: OAI-SearchBot
  Allow: /
  ```
- `ChatGPT-User` follows robots.txt but can be user-triggered

---

### Anthropic (Claude)

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `anthropic-ai` | Training | Claude model training | ⚠️ Training only |
| `ClaudeBot` | Search/Citation | **Claude.ai citations** | 🔴 CRITICAL |
| `claude-web` | Crawl | Generic Claude web crawling | ⭐⭐ |

**Full ClaudeBot User-Agent:**
```
Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)
```

**robots.txt snippet:**
```
User-agent: anthropic-ai
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: claude-web
Allow: /
```

**If you want to separate training from citations:**
```
User-agent: anthropic-ai
Disallow: /
User-agent: ClaudeBot
Allow: /
```

---

### Perplexity AI

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `PerplexityBot` | Index | **Builds Perplexity index** | 🔴 CRITICAL |
| `Perplexity-User` | On-demand | Fetch when user clicks citation | ⭐⭐⭐ |

**robots.txt snippet:**
```
User-agent: PerplexityBot
Allow: /
User-agent: Perplexity-User
Allow: /
```

**Notes:**
- Perplexity is one of the AI engines that cites web sources the most
- `PerplexityBot` is the most important for visibility

---

### Google AI (Gemini)

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `Google-Extended` | Training/AI | Gemini training and AI Overviews | ⭐⭐⭐ |
| `Googlebot` | Search | Traditional Google Search | 🔴 CRITICAL |

**robots.txt snippet:**
```
User-agent: Google-Extended
Allow: /
User-agent: Googlebot
Allow: /
```

**Notes:**
- `Google-Extended` is a **robots.txt token**, not a separate user-agent
- Controls both Gemini training and AI Overviews in Google Search
- Blocking `Google-Extended` removes the site from Google AI Overviews

---

### Microsoft (Copilot/Bing)

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `Bingbot` | Search | Bing Search and Copilot | 🔴 CRITICAL |

**robots.txt snippet:**
```
User-agent: Bingbot
Allow: /
```

**Notes:**
- Copilot uses the Bing index: allowing Bingbot = allowing Copilot
- There is no separate "CopilotBot"

---

### Apple (Siri/AI)

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `Applebot` | Search | Siri, Spotlight Search | ⭐⭐ |
| `Applebot-Extended` | Training | Apple Intelligence training | ⭐ |

**robots.txt snippet:**
```
User-agent: Applebot
Allow: /
User-agent: Applebot-Extended
Allow: /
```

---

### Meta (Facebook AI)

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `FacebookBot` | Preview | Facebook/Instagram link preview | ⭐ |
| `meta-externalagent` | Backup | Meta backup fetcher | ⭐ |

**robots.txt snippet:**
```
User-agent: FacebookBot
Allow: /
User-agent: meta-externalagent
Allow: /
```

---

### ByteDance/TikTok

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `Bytespider` | AI/Rec | TikTok AI, recommendations | ⭐⭐ |

**robots.txt snippet:**
```
User-agent: Bytespider
Allow: /
```

---

### DuckDuckGo

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `DuckAssistBot` | AI | DuckAssist AI answers | ⭐ |

---

### Cohere

| User-Agent | Type | Purpose | GEO Priority |
|-----------|------|---------|--------------|
| `cohere-ai` | Training | Cohere model training | ⭐ |
| `cohere-training-data-crawler` | Training | Cohere data crawler | ⭐ |

---

### Academic & Open Source

| User-Agent | Type | Purpose |
|-----------|------|---------|
| `AI2Bot` | Academic | Allen Institute for AI, Semantic Scholar |
| `CCBot` | Open | Common Crawl — base for many models |
| `Diffbot` | Data | Structured data extraction |
| `omgili` | Forum | Forums and discussions |
| `LinkedInBot` | Preview | LinkedIn link preview |
| `Amazonbot` | AI | Alexa, Fire OS AI |

---

## robots.txt Strategies

### Strategy 1: Allow All (Maximum AI Visibility) ✅
```
User-agent: *
Allow: /
```
Simple, allows everything. Ideal for content sites that want maximum visibility.

### Strategy 2: Allow citations, block training
```
# Training — block (no AI training data)
User-agent: GPTBot
Disallow: /
User-agent: anthropic-ai
Disallow: /
User-agent: Google-Extended
Disallow: /
User-agent: CCBot
Disallow: /

# AI citations — allow
User-agent: OAI-SearchBot
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Bingbot
Allow: /
```

### Strategy 3: Block everything except Google
```
User-agent: Googlebot
Allow: /
User-agent: Bingbot
Allow: /
User-agent: *
Disallow: /
```
⚠️ Removes the site from all AI search engines.

---

## Verify with curl

Test whether a bot can access your site:

```bash
# Simulate GPTBot
curl -A "GPTBot" https://yoursite.com/robots.txt

# Simulate ClaudeBot
curl -A "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)" https://yoursite.com

# Simulate PerplexityBot
curl -A "PerplexityBot/1.0 (+https://perplexity.ai/bot)" https://yoursite.com
```

---

## Monitor Bots in Logs

Search server logs (nginx/apache):

```bash
# Search all AI bots in nginx logs
grep -E "GPTBot|OAI-SearchBot|ClaudeBot|PerplexityBot|Google-Extended|anthropic-ai|claude-web" /var/log/nginx/access.log

# Count visits per bot
grep -oE "GPTBot|OAI-SearchBot|ClaudeBot|PerplexityBot" /var/log/nginx/access.log | sort | uniq -c | sort -rn
```

---

## Official Resources

- OpenAI: https://openai.com/gptbot
- Anthropic: https://www.anthropic.com/legal/aup
- Perplexity: https://docs.perplexity.ai/guides/perplexity-bot
- Google: https://developers.google.com/search/docs/crawling-indexing/google-common-crawlers
- Momentic Marketing Bot List: https://momenticmarketing.com/blog/ai-search-crawlers-bots
- Search Engine Journal: https://www.searchenginejournal.com/ai-crawler-user-agents-list/
