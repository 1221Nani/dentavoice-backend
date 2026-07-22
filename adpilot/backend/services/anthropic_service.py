import os
import json
import anthropic
from anthropic import AsyncAnthropic


def _trunc(s, n):
    """Truncate string to n chars at a word boundary if possible."""
    if not isinstance(s, str) or len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut if cut else s[:n]


def _enforce_ad_limits(brief: dict, platform: str) -> dict:
    """Programmatically enforce Meta/Google character limits — don't trust the model to count."""
    if platform == "meta":
        for copy in brief.get("ad_copies", []):
            copy["headline"] = _trunc(copy.get("headline", ""), 40)
            copy["primary_text"] = _trunc(copy.get("primary_text", ""), 125)
            copy["description"] = _trunc(copy.get("description", ""), 30)
    else:
        for ag in brief.get("ad_groups", []):
            rsa = ag.get("rsa", {})
            rsa["headlines"] = [_trunc(h, 30) for h in rsa.get("headlines", [])]
            rsa["descriptions"] = [_trunc(d, 90) for d in rsa.get("descriptions", [])]
        exts = brief.get("extensions", {})
        for sl in exts.get("sitelinks", []):
            sl["title"] = _trunc(sl.get("title", ""), 25)
            sl["description"] = _trunc(sl.get("description", ""), 35)
    return brief


def _friendly_error(e: Exception) -> ValueError:
    """Convert Anthropic SDK exceptions into clean user-facing messages."""
    if isinstance(e, anthropic.AuthenticationError):
        return ValueError(
            "Anthropic API key is invalid or expired. Update it in Settings → AI Services."
        )
    if isinstance(e, anthropic.RateLimitError):
        return ValueError("Anthropic rate limit reached. Please wait a moment and try again.")
    if isinstance(e, anthropic.APIStatusError):
        msg = str(getattr(e, "message", "") or "")
        if "credit" in msg.lower() or "billing" in msg.lower():
            return ValueError(
                "Anthropic API key has insufficient credits. "
                "Top up at console.anthropic.com to re-enable AI features."
            )
        return ValueError(
            f"Anthropic API error (HTTP {e.status_code}). Please check your API key in Settings."
        )
    if isinstance(e, anthropic.APIConnectionError):
        return ValueError("Could not connect to Anthropic API. Check your internet connection.")
    return ValueError("AI service temporarily unavailable. Please try again in a moment.")


class AnthropicService:
    def __init__(self, settings: dict = None):
        _s = settings or {}
        self.api_key = _s.get("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_API_KEY")

    def _is_configured(self) -> bool:
        return bool(self.api_key)

    def _client(self) -> AsyncAnthropic:
        return AsyncAnthropic(api_key=self.api_key)

    async def generate_ad_copy(
        self,
        product: str,
        audience: str,
        platform: str,
        objective: str,
        tone: str = "professional",
        num_variants: int = 3,
    ) -> list[dict]:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        if platform == "google":
            sets_label = f"{num_variants} RSA set{'s' if num_variants > 1 else ''}"
            theme_instruction = (
                f"\nEach set must use a DIFFERENT primary angle/theme (e.g. Set 1: benefits-focused, Set 2: urgency/offer-focused, Set 3: social proof/trust-focused). Headlines must not repeat across sets."
                if num_variants > 1 else ""
            )
            prompt = f"""You are a Google Ads specialist. Generate {sets_label} of Responsive Search Ad (RSA) assets.

Product/Service: {product}
Target Audience: {audience}
Campaign Objective: {objective}
Tone: {tone}{theme_instruction}

STRICT REQUIREMENTS PER SET:
- Exactly 15 unique headlines. Count them: 1 through 15.
- Every headline MUST be ≤30 characters — count every character including spaces.
- Exactly 4 descriptions. Each MUST be ≤90 characters.
- Cover different angles per set: benefit, urgency, social proof, feature, question, CTA, price, guarantee.
- No punctuation at the end of headlines (Google policy).

Return ONLY a valid JSON array with {num_variants} object(s). No markdown, no explanation.
Format:
[{{"type":"google_rsa","set":1,"headlines":["H1","H2","H3","H4","H5","H6","H7","H8","H9","H10","H11","H12","H13","H14","H15"],"descriptions":["D1 under 90 chars","D2 under 90 chars","D3 under 90 chars","D4 under 90 chars"]}}]"""
        else:
            prompt = f"""You are a Meta Ads specialist. Generate {num_variants} Facebook/Instagram ad copy variants.

Product/Service: {product}
Target Audience: {audience}
Campaign Objective: {objective}
Tone: {tone}

STRICT CHARACTER LIMITS (count carefully):
- hook: attention-grabbing opening line, any length
- headline: MUST be ≤40 characters (bold text below image)
- primary_text: MUST be ≤125 characters (main body copy)
- description: MUST be ≤30 characters (small text below headline)
- cta: button label only (e.g. "Shop Now", "Learn More", "Book Now")

Return ONLY a valid JSON array, no markdown:
[{{"hook":"...","headline":"...","primary_text":"...","description":"...","cta":"..."}}]"""

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": prompt}],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        result = json.loads(text.strip())
        return result if isinstance(result, list) else [result]

    async def generate_campaign_brief(self, prompt: str, platform: str) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        if platform == "meta":
            sys_msg = "You are a senior Meta Ads strategist with 10+ years managing high-performing Facebook and Instagram campaigns across every industry. You know Meta's interest taxonomy, behavior targeting, lookalike audiences, and ad formats deeply."
            user_msg = f"""A client gave you this brief: "{prompt}"

Generate a COMPLETE, launch-ready Meta Ads campaign. Be specific and research-grade — not generic.

STRICT CHARACTER RULES (count every character including spaces):
- headline: MUST be ≤40 characters — hard limit, no exceptions
- primary_text: MUST be ≤125 characters — hard limit
- description: MUST be ≤30 characters — hard limit, keep it tight
Count before writing each field. If it's over the limit, shorten it before including it.

Return ONLY valid JSON (no markdown):
{{
  "campaign": {{
    "name": "Brand — Objective — Month Year",
    "objective": "leads",
    "daily_budget": 50,
    "budget_reasoning": "1-2 sentences why this budget is right for the goal and audience size"
  }},
  "audience": {{
    "age_min": 25,
    "age_max": 65,
    "genders": "all",
    "locations": ["City, State" or "Country"],
    "interests": [
      {{"name": "specific Meta interest name", "category": "Meta category"}},
      {{"name": "...", "category": "..."}}
    ],
    "behaviors": ["specific Meta behavior 1", "specific Meta behavior 2"],
    "lookalike_seeds": ["Website visitors (pixel)", "Customer email list", "Page engagers"],
    "exclusions": ["Existing customers", "Employees"]
  }},
  "ad_copies": [
    {{
      "name": "Variant 1 — Benefit angle",
      "hook": "Attention-grabbing opening line (no limit)",
      "headline": "≤40 chars STRICT",
      "primary_text": "≤125 chars STRICT",
      "description": "≤30 chars STRICT",
      "cta": "Book Now"
    }},
    {{
      "name": "Variant 2 — Urgency angle",
      "hook": "...", "headline": "...", "primary_text": "...", "description": "...", "cta": "..."
    }},
    {{
      "name": "Variant 3 — Social proof angle",
      "hook": "...", "headline": "...", "primary_text": "...", "description": "...", "cta": "..."
    }}
  ],
  "placements": ["Facebook Feed", "Instagram Feed", "Instagram Stories", "Facebook Stories", "Reels"],
  "bidding": {{
    "strategy": "Lowest cost",
    "optimization_event": "Lead"
  }}
}}

Generate 10-15 interests, 3-5 behaviors. Make interests very specific to the actual business — not just generic wellness/fitness if it's a specific niche."""

        else:  # google
            sys_msg = "You are a senior Google Ads strategist with 10+ years managing Search campaigns. You deeply understand keyword intent, match types, Quality Score, RSA best practices, negative keyword strategy, and ad extensions."
            user_msg = f"""A client gave you this brief: "{prompt}"

Generate a COMPLETE, launch-ready Google Search Ads campaign. Be specific and research-grade.

STRICT CHARACTER RULES:
- Every RSA headline MUST be ≤30 characters (count spaces too)
- Every RSA description MUST be ≤90 characters
- Each ad group needs exactly 15 headlines and 4 descriptions

Return ONLY valid JSON (no markdown):
{{
  "campaign": {{
    "name": "Brand — Search — Objective — Month Year",
    "objective": "leads",
    "daily_budget": 50,
    "budget_reasoning": "1-2 sentences why this budget",
    "bidding_strategy": "Maximize Conversions",
    "target_cpa": null
  }},
  "ad_groups": [
    {{
      "name": "Theme Name (e.g. Massage Therapy)",
      "keywords": [
        {{"keyword": "specific keyword", "match_type": "exact"}},
        {{"keyword": "broader keyword", "match_type": "phrase"}},
        {{"keyword": "general term", "match_type": "broad"}}
      ],
      "rsa": {{
        "headlines": ["H1 ≤30", "H2 ≤30", "H3", "H4", "H5", "H6", "H7", "H8", "H9", "H10", "H11", "H12", "H13", "H14", "H15"],
        "descriptions": ["D1 under 90 chars", "D2 under 90 chars", "D3 under 90 chars", "D4 under 90 chars"]
      }}
    }}
  ],
  "negative_keywords": ["irrelevant term", "diy keyword", "free keyword", "job/career terms"],
  "extensions": {{
    "sitelinks": [
      {{"title": "max 25 chars", "description": "max 35 chars", "url": "/page-path"}},
      {{"title": "...", "description": "...", "url": "..."}}
    ],
    "callouts": ["Free Consultation", "Same-Day Booking", "Certified Experts", "5-Star Rated"],
    "structured_snippet": {{"header": "Services", "values": ["Service 1", "Service 2", "Service 3", "Service 4"]}}
  }}
}}

Generate exactly 3 thematically distinct ad groups with 6-8 keywords each. Include 10-15 negative keywords covering irrelevant searches, DIY intent, and job/career terms."""

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=8000,
                system=sys_msg,
                messages=[{"role": "user", "content": user_msg}],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        try:
            brief = json.loads(text)
        except json.JSONDecodeError:
            last_brace = text.rfind("}")
            if last_brace != -1:
                truncated = text[:last_brace + 1]
                opens = truncated.count("{") - truncated.count("}")
                arr_opens = truncated.count("[") - truncated.count("]")
                truncated += "]" * arr_opens + "}" * opens
                try:
                    brief = json.loads(truncated)
                except json.JSONDecodeError:
                    raise ValueError("AI response was too long and could not be parsed. Try a shorter/simpler prompt.")
            else:
                raise ValueError("AI response was too long and could not be parsed. Try a shorter/simpler prompt.")

        return _enforce_ad_limits(brief, platform)

    async def generate_optimization_recommendations(self, campaigns_data: list[dict]) -> list[dict]:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=3000,
                messages=[{
                    "role": "user",
                    "content": f"""Analyze these ad campaign metrics and provide actionable optimization recommendations:

{json.dumps(campaigns_data, indent=2)}

Return a JSON array of recommendations, each with:
- title: string (concise action title)
- description: string (detailed explanation of what to do and why)
- impact: "high" | "medium" | "low"
- type: "budget" | "bid" | "pause" | "creative" | "targeting"
- campaign_name: string (which campaign this applies to, or "all")
- estimated_improvement: string (e.g., "+15% ROAS", "Save $200/week")

Focus on data-driven insights. Return ONLY valid JSON array.""",
                }],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_performance_insights(self, campaigns: list[dict], totals: dict) -> list[dict]:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": f"""You are a senior performance marketing analyst. Analyze this ad account data and return exactly 4-6 insight cards that a marketing manager needs to act on today.

ACCOUNT TOTALS (current period):
{json.dumps(totals, indent=2)}

CAMPAIGN BREAKDOWN:
{json.dumps(campaigns, indent=2)}

Return a JSON array. Each object must have:
- type: "success" | "warning" | "danger" | "info"
- title: string (max 60 chars, direct and specific)
- insight: string (1-2 sentences with real numbers from the data, explain the WHY)
- action: string (specific next step, max 80 chars)
- metric: string (the key metric driving this insight, e.g. "ROAS 0.4x", "CTR 0.2%")
- campaign: string | null (campaign name if insight is campaign-specific, else null)

Rules:
- Use actual numbers from the data — never say "some campaigns" or "high spend"
- type "danger" = immediate action needed (negative ROAS, CPA >3x target)
- type "warning" = needs attention soon (declining CTR, budget waste)
- type "success" = scaling opportunity (strong ROAS, high CVR)
- type "info" = useful observation

Return ONLY valid JSON array, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    def calculate_health_score(self, campaigns: list[dict], totals: dict) -> dict:
        score = 0
        reasons = []
        suggestions = []

        ctr = totals.get("ctr", 0)
        roas = totals.get("roas", 0)
        spend = totals.get("spend", 0)
        conversions = totals.get("conversions", 0)
        clicks = totals.get("clicks", 0)
        cvr = (conversions / clicks * 100) if clicks else 0

        # CTR score (0-25)
        if ctr >= 3:
            score += 25
            reasons.append(f"Excellent CTR of {ctr:.2f}%")
        elif ctr >= 2:
            score += 20
            reasons.append(f"Good CTR of {ctr:.2f}%")
        elif ctr >= 1:
            score += 13
            reasons.append(f"Average CTR of {ctr:.2f}% — room to improve ad creative")
            suggestions.append("Test new headline variants to improve CTR above 2%")
        elif ctr >= 0.5:
            score += 6
            reasons.append(f"Low CTR of {ctr:.2f}% — creative refresh needed")
            suggestions.append("Refresh ad creatives; current CTR is below industry average")
        else:
            score += 2
            reasons.append(f"Very low CTR of {ctr:.2f}% — significant creative issue")
            suggestions.append("Pause low-CTR campaigns and rebuild creative strategy")

        # ROAS score (0-30)
        if roas >= 5:
            score += 30
            reasons.append(f"Outstanding ROAS of {roas:.2f}x")
        elif roas >= 3:
            score += 24
            reasons.append(f"Strong ROAS of {roas:.2f}x")
        elif roas >= 2:
            score += 16
            reasons.append(f"Acceptable ROAS of {roas:.2f}x — optimize to reach 3x")
            suggestions.append("Focus budget on top-ROAS campaigns to lift overall return")
        elif roas >= 1:
            score += 8
            reasons.append(f"Marginal ROAS of {roas:.2f}x — barely breaking even")
            suggestions.append("Review audience targeting and landing pages for conversion leaks")
        else:
            score += 2
            reasons.append(f"Negative ROAS of {roas:.2f}x — spending more than earning")
            suggestions.append("Pause all campaigns immediately and audit conversion tracking")

        # Conversion rate score (0-25)
        if cvr >= 5:
            score += 25
            reasons.append(f"High conversion rate of {cvr:.1f}%")
        elif cvr >= 3:
            score += 20
            reasons.append(f"Good conversion rate of {cvr:.1f}%")
        elif cvr >= 1:
            score += 12
            reasons.append(f"Average conversion rate of {cvr:.1f}%")
            suggestions.append("A/B test landing pages to improve conversion rate above 3%")
        elif cvr > 0:
            score += 5
            reasons.append(f"Low conversion rate of {cvr:.1f}%")
            suggestions.append("Audit landing page UX and offer — conversion rate below 1% indicates friction")
        else:
            score += 0
            reasons.append("No conversions tracked — check conversion tracking setup")
            suggestions.append("Verify conversion tracking is correctly configured on all campaigns")

        # Campaign activity score (0-20)
        active = [c for c in campaigns if c.get("status") == "active" and c.get("spend", 0) > 0]
        total = len(campaigns)
        if total == 0:
            score += 0
            suggestions.append("Create and launch your first campaign to start gathering data")
        elif len(active) / total >= 0.5:
            score += 20
            reasons.append(f"{len(active)}/{total} campaigns active with spend")
        elif len(active) > 0:
            score += 10
            reasons.append(f"Only {len(active)}/{total} campaigns generating spend")
            suggestions.append(f"Review {total - len(active)} inactive campaigns — reactivate or remove")
        else:
            score += 0
            reasons.append("No campaigns actively spending")
            suggestions.append("Activate campaigns or sync latest data from ad platforms")

        score = min(100, max(0, score))

        if score >= 80:
            grade = "Excellent"
        elif score >= 65:
            grade = "Good"
        elif score >= 45:
            grade = "Fair"
        elif score >= 25:
            grade = "Poor"
        else:
            grade = "Critical"

        return {"score": score, "grade": grade, "reasons": reasons, "suggestions": suggestions}

    async def generate_account_audit(self, campaigns: list[dict], totals: dict, platform: str = "all") -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=3000,
                messages=[{"role": "user", "content": f"""You are a senior paid media consultant performing a professional account audit. Be specific, data-driven, and direct. Do not use filler phrases.

PLATFORM: {platform}
ACCOUNT TOTALS:
{json.dumps(totals, indent=2)}

CAMPAIGNS:
{json.dumps(campaigns, indent=2)}

Return a JSON object with:
- strengths: list of 2-4 strings (what is working well, with numbers)
- weaknesses: list of 2-4 strings (what is underperforming, with numbers)
- risks: list of 1-3 strings (what could hurt performance if ignored)
- opportunities: list of 2-4 strings (specific actions that could grow results, with estimated impact)
- recommended_actions: list of 3-5 objects, each with:
  - priority: "immediate" | "this_week" | "this_month"
  - action: string (specific, actionable task)
  - expected_impact: string (e.g., "+20% ROAS", "Save $500/month")
- summary: string (2-3 sentences overall account health narrative)

Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_opportunities(self, campaigns: list[dict], totals: dict) -> list[dict]:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": f"""You are a paid media strategist. Identify specific revenue and efficiency opportunities from this account data.

ACCOUNT TOTALS:
{json.dumps(totals, indent=2)}

CAMPAIGNS:
{json.dumps(campaigns, indent=2)}

Return a JSON array of 3-6 opportunities. Each must have:
- id: string (unique slug, e.g. "scale-campaign-x")
- type: "scale" | "pause" | "budget_shift" | "creative_refresh" | "audience" | "bid"
- title: string (max 60 chars, specific)
- description: string (2-3 sentences with real numbers explaining the opportunity)
- campaign: string | null (campaign name if specific, else null)
- expected_impact: string (e.g., "+$2,400/month revenue", "Save $800/month")
- confidence: "high" | "medium" | "low"
- effort: "low" | "medium" | "high"

Prioritize high-confidence, low-effort opportunities first. Use actual numbers from the data.
Return ONLY valid JSON array, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_report_narration(
        self, totals: dict, chart_data: list[dict], campaign_breakdown: list[dict], period: str
    ) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{"role": "user", "content": f"""You are a performance marketing analyst writing an executive report summary. Be concise, specific, and business-focused.

PERIOD: {period}
TOTALS:
{json.dumps(totals, indent=2)}

TOP CAMPAIGNS:
{json.dumps(campaign_breakdown[:5], indent=2)}

Return a JSON object with:
- headline: string (1 sentence summarizing the period performance)
- spend_narrative: string (1-2 sentences on spend efficiency and trend)
- revenue_narrative: string (1-2 sentences on revenue and ROAS)
- ctr_narrative: string (1 sentence on CTR with context — is this good or bad?)
- conversion_narrative: string (1-2 sentences on conversions and CPA)
- top_performer: string (1 sentence naming the top campaign and why)
- concern: string | null (1 sentence on the biggest risk or issue, null if everything looks healthy)
- recommendation: string (1-2 sentences on the single most impactful next action)

Use real numbers. Write like a consultant, not a dashboard tooltip.
Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)

        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_competitor_insights(self, competitor_ads: list[dict]) -> str:
        if not self._is_configured():
            return "Configure Anthropic API key in Settings → AI Services to get AI insights on competitor ads."

        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1500,
                messages=[{
                    "role": "user",
                    "content": f"""Analyze these competitor ads and provide strategic insights:

{json.dumps(competitor_ads, indent=2)}

Provide:
1. Common messaging themes and hooks being used
2. Gaps/opportunities in the market based on what competitors aren't saying
3. Creative formats that appear most frequently
4. Recommended differentiators for our campaigns
5. CTAs competitors are using most

Keep it concise and actionable (under 400 words).""",
                }],
            )
            return message.content[0].text
        except Exception as e:
            raise _friendly_error(e)

    # ---------------------------------------------------------------------
    # Google Ads Audit Toolkit — one AI method per skill. Every method follows
    # the same shape as the analysis above: JSON-only prompt, markdown-fence
    # strip, json.loads. Callers (routers/audit.py) wrap each in try/except
    # with a deterministic rule-based fallback, same pattern as optimizer.py
    # and insights.py, so every skill still returns useful output with no
    # Anthropic key configured or with credits depleted.
    # ---------------------------------------------------------------------

    async def generate_rank_budget_analysis(self, campaigns: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": f"""You are a Google Ads Search specialist. For each Search campaign below, diagnose whether it's losing impression share to a weak Ad Rank (needs better ads/bids/Quality Score) or a capped budget (needs more money), using search_rank_lost_impression_share vs search_budget_lost_impression_share.

CAMPAIGNS:
{json.dumps(campaigns, indent=2)}

Return a JSON object with:
- summary: string (2-3 sentence account-level narrative)
- findings: array of objects, one per campaign with impression-share data, each with:
  - campaign_name: string
  - diagnosis: "rank_constrained" | "budget_constrained" | "both" | "healthy"
  - impression_share_pct: number
  - rank_lost_pct: number
  - budget_lost_pct: number
  - recommendation: string (specific next step)

Skip campaigns with no impression-share data (Shopping/PMax). Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_wasted_spend_analysis(self, search_terms: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": f"""You are a Google Ads specialist auditing search terms for wasted spend. These are actual queries that triggered ads, sorted by cost descending, already filtered to terms with meaningful spend and zero conversions.

SEARCH TERMS:
{json.dumps(search_terms[:100], indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences on total waste identified and the pattern behind it)
- total_wasted_spend: number (sum of cost for terms you flag as irrelevant/low-intent)
- findings: array of objects, each with:
  - search_term: string
  - cost: number
  - clicks: number
  - reason: string (why this term is likely wasted spend — off-topic, DIY intent, job-seeker intent, wrong product, etc.)
  - recommended_action: "add_as_negative" | "monitor" | "keep"

Only include terms you're genuinely confident are wasted — don't flag legitimate high-intent terms that simply haven't converted yet due to low volume. Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_negative_term_analysis(self, search_terms: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": f"""You are a Google Ads Shopping/Performance Max specialist. These search terms triggered Shopping or PMax ads. Shopping campaigns have no keyword targeting, so irrelevant terms leak in more easily than in Search — find terms that don't match what's actually being sold.

SEARCH TERMS (Shopping/PMax only):
{json.dumps(search_terms[:100], indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences on the pattern of irrelevant traffic found)
- findings: array of objects, each with:
  - search_term: string
  - cost: number
  - clicks: number
  - reason: string (why this term doesn't match the product being advertised)
  - recommended_action: "add_as_negative" | "monitor"

Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_rsa_grade_analysis(self, ads: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": f"""You are a Google Ads Responsive Search Ad specialist. Grade these RSAs using their ad_strength and per-asset performance_label (LOW/GOOD/BEST/PENDING/UNRATED for each headline/description).

RSA ASSET DATA (grouped by ad):
{json.dumps(ads, indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences on overall ad copy quality across the account)
- findings: array of objects, one per ad group with:
  - campaign_name: string
  - ad_group_name: string
  - ad_strength: string
  - low_performing_asset_count: number
  - recommendation: string (specific rewrite guidance — which asset types need work)

Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_shopping_grade_analysis(self, products: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": f"""You are a Shopping Ads specialist. For each product below, recommend whether to scale (increase visibility/bid), hold, or kill (exclude) it based on spend, conversions, and ROAS.

PRODUCTS:
{json.dumps(products[:150], indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences on overall product feed performance)
- findings: array of objects, each with:
  - product_title: string
  - cost: number
  - conversions: number
  - roas: number
  - verdict: "scale" | "hold" | "kill"
  - reasoning: string

Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_pmax_search_scorecard(self, campaigns: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": f"""You are a Google Ads specialist comparing Performance Max against Search campaigns on the same account. Google restricts some PMax reporting granularity, so treat PMax numbers as directional, not precise.

CAMPAIGNS (with advertising_channel_type):
{json.dumps(campaigns, indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences comparing the two channel types on efficiency)
- search_totals: object with spend, conversions, roas (aggregated across SEARCH campaigns)
- pmax_totals: object with spend, conversions, roas (aggregated across PERFORMANCE_MAX campaigns)
- recommendation: string (where to shift budget, if anywhere, and why)

Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_pmax_asset_grade(self, asset_groups: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2000,
                messages=[{"role": "user", "content": f"""You are a Performance Max creative specialist. Grade these asset groups by how many of their assets carry a LOW performance_label vs GOOD/BEST.

ASSET GROUPS (grouped by asset group):
{json.dumps(asset_groups, indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences on overall PMax creative health)
- findings: array of objects, one per asset group with:
  - campaign_name: string
  - asset_group_name: string
  - low_performing_asset_count: number
  - recommendation: string

Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())

    async def generate_buyer_intent_filter(self, keyword_ideas: list[dict]) -> dict:
        if not self._is_configured():
            raise ValueError("Anthropic API key not configured. Add it in Settings → AI Services.")
        try:
            client = self._client()
            message = await client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=2500,
                messages=[{"role": "user", "content": f"""You are a Google Ads keyword research specialist. From these keyword ideas (with search volume and competition data), identify which show genuine BUYER intent (ready to purchase/book/hire) versus informational or research intent (learning, comparing, DIY).

KEYWORD IDEAS:
{json.dumps(keyword_ideas[:150], indent=2)}

Return a JSON object with:
- summary: string (2-3 sentences on the buyer-intent keyword opportunity found)
- findings: array of objects, each with:
  - keyword: string
  - avg_monthly_searches: number
  - competition: string
  - intent: "buyer" | "informational" | "navigational"
  - reasoning: string (brief)

Sort findings by buyer-intent confidence, highest first. Return ONLY valid JSON, no markdown."""}],
            )
        except Exception as e:
            raise _friendly_error(e)
        text = message.content[0].text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return json.loads(text.strip())
