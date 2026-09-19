# CrediLens AI — Multi-Agent Credit Intelligence & Underwriting System

An AI-powered credit underwriting platform that automates company financial analysis using a multi-agent system built on n8n, with real-time financial data ingestion, deterministic risk scoring, and a React-based dashboard.

## Overview

CrediLens AI takes a company name and requested loan amount, then:

1. Resolves the company and pulls live financial statements (income statement, balance sheet, cash flow) from Yahoo Finance
2. Computes financial ratios, stress-test scenarios (base / downside 15% / severe 30%), and a deterministic underwriting score
3. Runs four specialized LLM agents in parallel — Financial Health, Cash Flow & Repayment, Industry & Market, and Anomaly & Stress — each assessing the company from its own lens
4. A Supervisory Credit Committee agent synthesizes all four assessments into a final Approve / Review / Reject decision
5. Includes a **deterministic safeguard layer**: if any AI agent's output is incomplete or unreliable on a given run, the system falls back to a ratio-based score computed directly from verified financial data, so the final report never shows a broken or empty result

## Architecture

## Tech Stack

- **Workflow orchestration:** n8n (self-hosted via Docker)
- **LLM inference:** Groq (openai/gpt-oss-120b)
- **Financial data:** Yahoo Finance (unofficial API)
- **Frontend:** React + TypeScript + Vite
- **Styling:** Custom CSS

## Setup

### 1. n8n (backend workflow)

```bash
docker run -d --name n8n -p 5678:5678 -v ~/.n8n:/home/node/.n8n --restart unless-stopped n8nio/n8n
```

Then:
1. Open `http://localhost:5678` and import [`n8n/n8n-workflow.json`](./n8n/n8n-workflow.json)
2. Add a Groq API credential (get a free key at [console.groq.com](https://console.groq.com)) on the "Groq Chat Model" node, model: `openai/gpt-oss-120b`
3. Click **Publish** to activate the webhook

### 2. Frontend

```bash
cd CrediLens-Frontend
npm install
npm run dev
```

The frontend expects the n8n webhook at `http://localhost:5678/webhook/credilens-auto-company-analysis` (configurable via `.env`).

## Key Design Decisions

- **Deterministic safeguards over blind AI trust.** LLM agents can occasionally return incomplete assessments. Rather than surfacing a broken 0-score card, the system falls back to a score computed directly from verified financial ratios (debt-to-equity, interest coverage, cash flow coverage, etc.), with the report clearly labeling when a safeguard was applied.
- **Stress testing.** Every company is evaluated under three scenarios (base, 15% downside, 30% severe downside) to assess resilience under adverse conditions, not just current-state health.
- **Data quality tracking.** Missing financial fields are tracked and factored into the confidence score rather than silently ignored.

## Project Report

See [`docs/`](./docs/) for the full project report.

---
Built as part of an MBA analytics coursework project.
