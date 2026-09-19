# CrediLens AI Frontend v2

This version is wired to the n8n production webhook and no longer contains the old hardcoded Tata Motors demo fallback.

## Run locally

1. Make sure n8n is running and the CrediLens v5 workflow is Published/Active.
2. The included `.env` points to:
   `http://localhost:5678/webhook/credilens-auto-company-analysis`
3. In PowerShell:

```powershell
cd path\to\CrediLens-Frontend-v2
npm install
npm run dev
```

4. Open the Vite URL, normally `http://localhost:5173`.
5. Enter a company/ticker and requested exposure, then click **Run analysis**.

## Important

Do NOT click "Execute Workflow" in n8n for the frontend production-webhook test. That button listens on the `/webhook-test/` endpoint. The frontend calls `/webhook/`.

If the browser shows a CORS error, check the n8n webhook/CORS configuration. The frontend request itself is a normal POST with JSON:
`{"companyName":"Infosys","requestedAmount":200000000}`.

The UI now normalizes the current v5 response shape, including:
- `financials` + `ratios`
- `credit_metrics.financial_health/cash_flow/repayment_capacity`
- `stressTests`
- `agentAssessments`
- `marketNews`
- data quality and anomaly flags

The visual theme has also been moved from near-black to a clean light finance dashboard while keeping the green CrediLens identity.
