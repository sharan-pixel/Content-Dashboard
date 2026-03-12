import { Topic } from './types';

export function buildTopicGenerationPrompt(performanceContext: string): string {
  return `You are a content strategist for a finance-focused Instagram creator. Generate **5 fresh Instagram Reel ideas** tailored to this specific audience and format.

${performanceContext ? `Recent performance context (last 30 days):\n${performanceContext}\nUse this to weight your topic selection toward what's resonating.\n\n` : ''}## Audience
- Age 25–40, Indian working professionals and business owners
- Earning ₹10 LPA and above
- Interested in: growing wealth, higher returns, tax savings, insurance, credit card hacks, avoiding financial scams, spotting institutional exploitation, new business opportunities and ideas
- They want content that is educational, insightful, and practically actionable — not generic gyaan

## Format
- Every reel is shot in **presenter format** (one person talking to camera)
- Keep each idea punchy — suitable for 30–90 second reels
- The hook (first 2 seconds) must stop the scroll

## What to generate for each idea

For each of the 5 ideas, provide:
1. **Topic Category** — one of: Tax Saving | Insurance | Credit Cards | Scam Alert | Institutional Tricks | Market & Portfolio | Business Opportunities | Wealth Growth | Misc Finance
2. **Reel Title** — a short, catchy working title
3. **Hook Line** — the exact opening line the presenter should say in the first 2 seconds to grab attention (write it word-for-word)
4. **Core Insight** — the ONE key takeaway the viewer should walk away with (1–2 sentences)
5. **Talking Points** — 3–4 bullet points covering what the presenter should cover in order
6. **CTA** — a natural call-to-action to end the reel (save, share, follow, comment, etc.)
7. **Source** — cite the specific article or post this idea came from, with a URL

## Daily variety rules
- Cover **at least 3 different topic categories** across the 5 ideas each day
- At least 1 idea should be tied to **something currently trending or in the news** this week
- At least 1 idea should be a **myth-buster or contrarian take**
- At least 1 idea should be a **practical how-to**

## Output quality bar
- Every idea must pass the test: "Would a 30-year-old earning ₹15 LPA stop scrolling and watch this?"
- Avoid jargon without explanation. Be relatable. Use examples with real Indian numbers (₹, lakhs, crores).
- No fluff, no filler. Every idea should make the viewer feel smarter in under 60 seconds.

Return your response as a JSON array of 5 objects with these exact fields:
- title (string)
- category (string)
- hook_line (string)
- core_insight (string)
- talking_points (array of strings)
- cta (string)
- source_url (string)

Return ONLY the JSON array, no markdown fencing, no explanation.`;
}

export function buildResearchTopicGenerationPrompt(researchContent: string): string {
  return `You are a content strategist for a finance-focused Instagram creator. Based on the following research material provided by the creator, generate **5 fresh Instagram Reel ideas**.

## Research Material
---
${researchContent.substring(0, 150000)}
---

## Audience
- Age 25–40, Indian working professionals and business owners
- Earning ₹10 LPA and above
- Interested in: growing wealth, higher returns, tax savings, insurance, credit card hacks, avoiding financial scams, spotting institutional exploitation, new business opportunities and ideas
- They want content that is educational, insightful, and practically actionable — not generic gyaan

## Format
- Every reel is shot in **presenter format** (one person talking to camera)
- Keep each idea punchy — suitable for 30–90 second reels
- The hook (first 2 seconds) must stop the scroll

## What to generate for each idea

For each of the 5 ideas, provide:
1. **Topic Category** — one of: Tax Saving | Insurance | Credit Cards | Scam Alert | Institutional Tricks | Market & Portfolio | Business Opportunities | Wealth Growth | Misc Finance
2. **Reel Title** — a short, catchy working title
3. **Hook Line** — the exact opening line the presenter should say in the first 2 seconds to grab attention (write it word-for-word)
4. **Core Insight** — the ONE key takeaway the viewer should walk away with (1–2 sentences)
5. **Talking Points** — 3–4 bullet points covering what the presenter should cover in order
6. **CTA** — a natural call-to-action to end the reel (save, share, follow, comment, etc.)

## Variety rules
- Cover **at least 3 different topic categories** across the 5 ideas
- Focus on the most unique, surprising, and compelling insights from the research material
- At least 1 idea should be a **myth-buster or contrarian take**
- At least 1 idea should be a **practical how-to**

## Output quality bar
- Every idea must pass the test: "Would a 30-year-old earning ₹15 LPA stop scrolling and watch this?"
- Avoid jargon without explanation. Be relatable. Use examples with real Indian numbers (₹, lakhs, crores).
- No fluff, no filler. Every idea should make the viewer feel smarter in under 60 seconds.

Return your response as a JSON array of 5 objects with these exact fields:
- title (string)
- category (string)
- hook_line (string)
- core_insight (string)
- talking_points (array of strings)
- cta (string)
- source_url (string — set to "User Research" if no specific URL is available)

Return ONLY the JSON array, no markdown fencing, no explanation.`;
}

export function buildInsightsPrompt(performanceData: string): string {
  return `You are a content performance analyst for an Indian finance Instagram creator (audience: 25-40, ₹10 LPA+).

Here is the raw performance data for their reels:
---
${performanceData}
---

Give exactly 3 sections. Be concise — bullet points only, no fluff. Use specific numbers from the data.

## What's Working
- Top performing categories, hook styles, and content patterns with numbers

## What's Not Working
- Underperforming categories, weak hooks, and content that isn't resonating with numbers

## What I'll Improve
- Concrete changes to make in future scripts: hook adjustments, category focus, structure tweaks

Keep it short and actionable. Max 3-4 bullets per section.`;
}

export function buildPerformanceLearnings(perfData: { title: string; category: string; hook_line: string; views: number; likes: number; shares: number; hook_rate: number | null }[]): string {
  if (perfData.length === 0) return '';

  // Compute category averages
  const catStats: Record<string, { views: number; shares: number; count: number }> = {};
  perfData.forEach((p) => {
    if (!catStats[p.category]) catStats[p.category] = { views: 0, shares: 0, count: 0 };
    catStats[p.category].views += p.views || 0;
    catStats[p.category].shares += p.shares || 0;
    catStats[p.category].count += 1;
  });

  const sorted = Object.entries(catStats)
    .map(([cat, s]) => ({ cat, avgViews: Math.round(s.views / s.count), avgShares: Math.round(s.shares / s.count), count: s.count }))
    .sort((a, b) => b.avgViews - a.avgViews);

  // Top 3 and bottom 3 performing reels
  const byViews = [...perfData].sort((a, b) => (b.views || 0) - (a.views || 0));
  const top3 = byViews.slice(0, 3);
  const bottom3 = byViews.slice(-3).reverse();

  let context = `\n## Performance Learnings (use these to write better scripts)\n`;
  context += `Based on ${perfData.length} published reels:\n\n`;
  context += `**Category performance (by avg views):**\n`;
  sorted.forEach((s) => {
    context += `- ${s.cat}: ${s.avgViews.toLocaleString()} avg views, ${s.avgShares.toLocaleString()} avg shares (${s.count} reels)\n`;
  });
  context += `\n**Top performing hooks:**\n`;
  top3.forEach((p) => {
    context += `- "${p.hook_line}" → ${(p.views || 0).toLocaleString()} views (${p.category})\n`;
  });
  context += `\n**Lowest performing hooks (avoid these patterns):**\n`;
  bottom3.forEach((p) => {
    context += `- "${p.hook_line}" → ${(p.views || 0).toLocaleString()} views (${p.category})\n`;
  });
  context += `\nApply these learnings: lean into hook styles and structures that worked. Avoid patterns from low performers. Match the energy and specificity of the top hooks.\n`;

  return context;
}

export function buildScriptGenerationPrompt(topic: Topic, performanceLearnings?: string): string {
  return `You are writing a presenter-style Instagram Reel script for an Indian finance creator.
The audience is 25-40 year old Indian professionals earning ₹10 LPA+.

Topic: ${topic.title}
Category: ${topic.category}
Hook line: ${topic.hook_line}
Core insight: ${topic.core_insight}
Talking points: ${topic.talking_points.join(', ')}
Source: ${topic.source_url || 'N/A'}
${performanceLearnings || ''}
Write a full script in this exact format with timestamp markers:

*[Hook — 0:00–0:04]*
...

*[Context — 0:04–0:14]*
...

*[The Mechanism / Detail — 0:14–0:35]*
...

*[The Surprising Part — 0:35–0:46]*
...

*[Close — 0:46–0:55]*
...

Rules:
- Direct to camera, conversational, no jargon without explanation
- Use real Indian numbers (₹, lakhs, crores)
- Every section must earn the next 10 seconds of attention
- The hook must stop a scroll in under 3 seconds
- End with a natural CTA (save, share, comment)
- Total runtime: 45–90 seconds

Here are reference scripts showing the exact quality and tone to match:

---
REFERENCE SCRIPT A (Market & Portfolio):
*[Hook — 0:00–0:03]*
One of India's most respected mutual fund managers just quietly exited HDFC. If you're invested in their funds — you need to know what this actually means.

*[Context — 0:03–0:14]*
Roshi Jain has been the face behind several of HDFC's top-performing equity funds. She didn't just manage money — she had a philosophy, a process, a track record. Fund managers like her are the reason people choose one fund house over another.

*[What Actually Changes — 0:14–0:35]*
Here's the part fund houses don't advertise. When a fund manager leaves, the strategy can shift. The stocks they believed in, the sectors they were overweight on, the risk tolerance they maintained — all of that is tied to the person, not just the fund. A new manager comes in, reviews the portfolio, and may not agree with every position. Over the next 6 to 12 months, you could see gradual rebalancing. The NAV might not move dramatically, but the underlying thesis you invested in has changed.

*[What You Should Do — 0:35–0:46]*
Don't panic-redeem. But do go back and check — why did you pick this fund in the first place? If the answer was the fund house's brand, you're probably fine. If the answer was specifically Roshi Jain's investment approach, it's worth watching the next two quarters closely before deciding.

*[Close — 0:46–0:55]*
In mutual funds, you're not just buying a product. You're buying a process managed by a person. When the person changes, the process might too. Staying informed is the cheapest thing you can do for your portfolio.

---
REFERENCE SCRIPT B (Wealth Growth — HNI):
*[Hook — 0:00–0:04]*
Every serious wealth manager I've spoken to gives the same advice on where to keep your money. Half in something you can't touch. Half in something that multiplies.

*[Context — 0:04–0:15]*
This isn't vague advice. It's an actual framework used by HNI advisors managing ₹50 crore+ portfolios. The idea is a 50/50 split between what they call Hard Assets — real estate — and Liquid Assets — equity and mutual funds.

*[The Mechanism — 0:15–0:38]*
Your equity portfolio is what they call a liquid "itch." When markets are up, you feel rich. When your friend buys a new car, the money is right there — accessible within 48 hours. So you scratch the itch. That's lifestyle creep, and it's how wealthy people quietly stay middle class. Real estate solves this. You can't sell your flat in a moment of weakness. That illiquidity is the feature, not the bug.

*[The Numbers — 0:38–0:48]*
One fund referenced delivered 18% CAGR over 10 to 15 years. A ₹1 crore investment in 2010 would be worth over ₹5 crore today. But only if you didn't touch it. The real estate allocation is what kept the hands off.

*[Close — 0:48–0:55]*
Most people fail at wealth not because they picked the wrong stocks. They fail because they had access to the right ones — and spent the gains. The 50/50 rule isn't about returns. It's about protecting you from yourself.

---

Match this quality and conversational tone exactly. Return ONLY the script, no additional commentary.`;
}

