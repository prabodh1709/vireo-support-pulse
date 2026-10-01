

import { useEffect, useMemo, useState } from "react";

import type { ChangeEvent } from "react";

import {

  loadBundledData,

  loadReplacementData,

  REQUIRED_FILES

} from "./data";

import {

  calculateDashboardMetrics,

  formatInr

} from "./metrics";

import { generateComplaintDigest } from "./ai";

import type { SupportData } from "./types";

type DataSource = "bundled" | "replacement";

function App() {

  const [data, setData] = useState<SupportData | null>(null);

  const [startDate, setStartDate] = useState("");

  const [endDate, setEndDate] = useState("");

  const [dataSource, setDataSource] = useState<DataSource>("bundled");

  const [loading, setLoading] = useState(true);

  const [replacing, setReplacing] = useState(false);

  const [error, setError] = useState("");

  const [aiDigest, setAiDigest] = useState("");

  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {

    void restoreBundledData();

  }, []);

  async function restoreBundledData() {

    setLoading(true);

    setError("");

    try {

      const bundledData = await loadBundledData();

      setData(bundledData);

      setDataSource("bundled");

      setStartDate("");

      setEndDate("");

    } catch (loadError) {

      setError(

        loadError instanceof Error

          ? loadError.message

          : "The Vireo data could not be loaded."

      );

    } finally {

      setLoading(false);

    }

  }

  async function replaceDataset(

    event: ChangeEvent<HTMLInputElement>

  ) {

    const selectedFiles = event.target.files;

    if (!selectedFiles || selectedFiles.length === 0) {

      return;

    }

    setReplacing(true);

    setError("");

    try {

      const replacementData =

        await loadReplacementData(selectedFiles);

      setData(replacementData);

      setDataSource("replacement");

      setStartDate("");

      setEndDate("");

    } catch (loadError) {

      setError(

        loadError instanceof Error

          ? loadError.message

          : "The replacement dataset could not be loaded."

      );

    } finally {

      setReplacing(false);

      event.target.value = "";

    }

  }

  const metrics = useMemo(() => {

    if (!data) return null;

    return calculateDashboardMetrics(

      data,

      startDate || undefined,

      endDate || undefined

    );

  }, [data, startDate, endDate]);

async function handleGenerateAiDigest() {

  if (!metrics || metrics.currentWeekTickets.length === 0) {

    return;

  }

  setAiLoading(true);

  setAiDigest("");

  try {

    const result = await generateComplaintDigest(

      metrics.currentWeekTickets

    );

    setAiDigest(result);

  } catch (aiError) {

    console.error("AI digest failed:", aiError);

    setAiDigest(

      "AI digest could not be generated. Please check the API configuration."

    );

  } finally {

    setAiLoading(false);

  }

}

  if (loading) {

    return (

      <main className="loading-screen">

        <div className="loading-mark">V</div>

        <p>Loading Vireo support data…</p>

      </main>

    );

  }

  if (error || !metrics) {

    return (

      <main className="error-screen">

        <div className="error-card">

          <span className="eyebrow">DATA LOAD ERROR</span>

          <h1>Vireo Support Pulse could not start</h1>

          <p>{error || "No support data was found."}</p>

          <p className="small-copy">

            Confirm that these five files exist inside{" "}

            <code>public/data</code>:

          </p>

          <ul>

            {REQUIRED_FILES.map((fileName) => (

              <li key={fileName}>{fileName}</li>

            ))}

          </ul>

          <button

            className="primary-button"

            onClick={restoreBundledData}

          >

            Try again

          </button>

        </div>

      </main>

    );

  }

  const sourceLabel =

    dataSource === "bundled"

      ? "Preloaded Vireo data"

      : "Replacement dataset";

  const effectiveStartDate =

    startDate || metrics.selectedStartDate;

  const effectiveEndDate =

    endDate || metrics.selectedEndDate;

  function handleStartDateChange(value: string) {

    setStartDate(value);

    if (effectiveEndDate && value > effectiveEndDate) {

      setEndDate(value);

    }

  }

  function handleEndDateChange(value: string) {

    setEndDate(value);

    if (effectiveStartDate && value < effectiveStartDate) {

      setStartDate(value);

    }

  }

  return (

    <main className="app-shell">

      <header className="topbar">

        <div>

          <div className="brand-row">

            <div className="brand-mark">V</div>

            <span className="brand-name">

              Vireo Support Pulse

            </span>

          </div>

          <p className="brand-subtitle">

            Support operations intelligence

          </p>

        </div>

        <div className="header-actions">

          <span className={`source-pill ${dataSource}`}>

            <span className="status-dot" />

            {sourceLabel}

          </span>

          <label className="secondary-button file-button">

            {replacing ? "Loading files…" : "Replace dataset"}

            <input

              type="file"

              accept=".csv,text/csv"

              multiple

              onChange={replaceDataset}

            />

          </label>

          <button

            className="ghost-button"

            onClick={restoreBundledData}

            disabled={dataSource === "bundled"}

          >

            Restore Vireo data

          </button>

        </div>

      </header>

      <section className="hero-section">

        <div>

          <span className="eyebrow">

            SUPPORT OPERATIONS REVIEW

          </span>

          <h1>

            See what customers are saying before it becomes a

            bigger problem.

          </h1>

          <p>

            Complaint signals, service-level risk, and Tier 1

            closure volume from Vireo’s support data.

          </p>

        </div>

        <div className="week-picker date-range-picker">

          <label>

            <span>Start date</span>

            <input
  type="date"
  value={effectiveStartDate}
  min="2025-01-01"
  max="2026-06-30"
  onChange={(event) =>
    handleStartDateChange(event.target.value)
  }
/>

          </label>

          <span className="date-range-arrow">→</span>

          <label>

            <span>End date</span>

            <input
  type="date"
  value={effectiveEndDate}
  min={effectiveStartDate || "2025-01-01"}
  max="2026-06-30"
  onChange={(event) =>
    handleEndDateChange(event.target.value)
  }
/>

          </label>

        </div>

      </section>

      <section

        className="metric-grid"

        aria-label="Selected period support metrics"

      >

        <article className="metric-card">

          <span className="metric-label">

            Tickets created

          </span>

          <strong>

            {metrics.ticketsCreated.toLocaleString("en-IN")}

          </strong>

          <span className="metric-detail">

            {metrics.ticketsResolvedOrClosed.toLocaleString(

              "en-IN"

            )}{" "}

            resolved or auto-closed

          </span>

        </article>

        <article className="metric-card warning-card">

          <span className="metric-label">

            SLA breaches

          </span>

          <strong>

            {metrics.slaBreaches.toLocaleString("en-IN")}

          </strong>

          <span className="metric-detail">

            {(metrics.slaBreachRate * 100).toFixed(1)}% of

            created tickets

          </span>

        </article>

        <article className="metric-card">

          <span className="metric-label">

            SLA credit exposure

          </span>

          <strong>

            {formatInr(metrics.slaCreditCost)}

          </strong>

          <span className="metric-detail">

            ₹350 per late first response

          </span>

        </article>

        <article className="metric-card">

          <span className="metric-label">CSAT</span>

          <strong>

            {metrics.averageCsat === null

              ? "—"

              : `${metrics.averageCsat.toFixed(1)} / 5`}

          </strong>

          <span className="metric-detail">

            {metrics.csatResponses} survey responses

          </span>

        </article>

      </section>


<section className="opportunity-card">

  <div>

    <span className="eyebrow">MEASURABLE OPPORTUNITY</span>

    <h2>Reduce SLA-credit exposure</h2>

    <p>
         Reducing SLA breaches from the current rate to the proposed
         6% target creates a forecasted reduction in quarterly
         SLA-credit exposure.
  </p>

  </div>

  <div className="opportunity-value">

    <span>Estimated quarterly exposure avoided</span>

    <strong>

      {formatInr(

        Math.max(

          0,

          (metrics.slaBreachRate - 0.06) *

            650 *

            13 *

            350

        )

      )}

    </strong>

    <small>

      Forecast only · based on ₹350 per SLA breach

    </small>

  </div>

</section>

      <section className="dashboard-grid">

        <article className="panel digest-panel">

          <div className="panel-heading">

            <div>

              <span className="eyebrow">

                COMPLAINT DIGEST

              </span>

              <h2>

                What customers are raising in this period

              </h2>

            </div>

            <span className="panel-note">

              vs. previous period

            </span>

          </div>

         <div className="ai-digest-action">

            <button

              className="secondary-button"

              onClick={handleGenerateAiDigest}

              disabled={aiLoading}

  >           {aiLoading ? "Analyzing tickets…" : "✨ Generate AI Digest"}

          </button>

              {aiDigest && (
          <div className="ai-digest-result">
            <span className="eyebrow">AI-ASSISTED SUMMARY</span>

            <div className="ai-theme-list">
              {aiDigest
                .split(/(?=THEME:)/i)
                .filter((block) => block.trim())
                .map((block, index) => {
                  const theme =
                    block
                      .match(/THEME:\s*(.*?)(?=\s*CUSTOMERS:)/is)?.[1]
                      ?.trim() || "Complaint theme";

                  const customers =
                    block
                      .match(/CUSTOMERS:\s*(.*?)(?=\s*IMPACT:)/is)?.[1]
                      ?.trim() || "Customer impact not available.";

                  const impact =
                    block.match(/IMPACT:\s*(.*)/is)?.[1]?.trim() ||
                    "Operational impact not available.";

                  return (
                    <div className="ai-theme-card" key={`${theme}-${index}`}>
                      <div className="ai-theme-number">
                        {String(index + 1).padStart(2, "0")}
                      </div>

                      <div className="ai-theme-content">
                        <h3>{theme}</h3>

                        <div className="ai-theme-section">
                          <span>CUSTOMERS</span>
                          <p>{customers}</p>
                        </div>

                        <div className="ai-theme-section">
                          <span>OPERATIONAL IMPACT</span>
                          <p>{impact}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        </div>

          <div className="category-list">

            {metrics.topCategories.map((item, index) => (

              <div

                className="category-row"

                key={item.category}

              >

                <span className="category-rank">

                  {String(index + 1).padStart(2, "0")}

                </span>

                <div className="category-name">

                  <strong>{item.category}</strong>

                  <span>{item.tickets} tickets</span>

                </div>

                <span

                  className={

                    item.change > 0

                      ? "trend rising"

                      : item.change < 0

                        ? "trend falling"

                        : "trend steady"

                  }

                >

                  {item.change > 0 ? "+" : ""}

                  {item.change} vs previous period

                </span>

              </div>

            ))}

          </div>

        </article>

        <article className="panel risk-panel">

          <div className="panel-heading">

            <div>

              <span className="eyebrow">

                POLICY & COST WATCH

              </span>

              <h2>Items that need attention</h2>

            </div>

          </div>

          <div className="risk-list">

            {metrics.risks.map((risk) => (

              <div

                className={`risk-row ${risk.severity}`}

                key={risk.id}

              >

                <span className="risk-level">

                  {risk.severity}

                </span>

                <div>

                  <strong>{risk.title}</strong>

                  <p>{risk.description}</p>

                </div>

              </div>

            ))}

          </div>

          <div className="transfer-summary">

            <span>Transfer cost in selected period</span>

            <strong>

              {formatInr(metrics.transferCost)}

            </strong>

            <small>

              {metrics.transferCount} hand-offs × ₹305

              planning cost

            </small>

          </div>

        </article>

      </section>

      <section className="repeat-contact-card">
  <div className="panel-heading">
    <div>
      <span className="eyebrow">REPEAT CONTACT SIGNAL</span>
      <h2>Customers contacting support more than once</h2>
    </div>

    <span className="panel-note">
      Selected period · deterministic proxy
    </span>
  </div>

  <div className="repeat-contact-grid">
    <div>
      <span>Repeat-contact customers</span>
      <strong>
        {metrics.repeatContactCustomers.toLocaleString("en-IN")}
      </strong>
    </div>

    <div>
      <span>Repeat-contact rate</span>
      <strong>
        {(metrics.repeatContactRate * 100).toFixed(1)}%
      </strong>
    </div>

    <div>
      <span>Customers with tickets</span>
      <strong>
        {metrics.uniqueCustomers.toLocaleString("en-IN")}
      </strong>
    </div>
  </div>
<div className="repeat-contact-customer-list">
  <div className="repeat-contact-list-heading">
    <strong>Repeat-contact customers</strong>
    <span>Top 3 shown</span>
  </div>

  {metrics.repeatContactCustomerList
    .slice(0, 3)
    .map((customer) => (
      <div
        className="repeat-contact-customer-row"
        key={customer.customerId}
      >
        <span>
  {(() => {
    const matchedCustomer = data?.customers.find((item) => {
      const record = item as {
        customerId?: string;
        id?: string;
        customer_id?: string;
      };

      return (
        record.customerId ??
        record.id ??
        record.customer_id
      )?.trim() === customer.customerId.trim();
    });

    return matchedCustomer?.name
      ? `${matchedCustomer.name} (${customer.customerId})`
      : customer.customerId;
  })()}
</span>
        <strong>{customer.ticketCount} tickets</strong>
      </div>
    ))}

  {metrics.repeatContactCustomerList.length > 3 && (
  <details className="repeat-contact-more">
    <div className="repeat-contact-list">
      {metrics.repeatContactCustomerList.slice(3).map((customer) => (
        <div
          className="repeat-contact-customer-row"
          key={customer.customerId}
        >
          <span>
  {(() => {
   const matchedCustomer = data?.customers.find((item) => {
      const record = item as {
        customerId?: string;
        id?: string;
        customer_id?: string;
      };

      return (
        record.customerId ??
        record.id ??
        record.customer_id
      )?.trim() === customer.customerId.trim();
    });

    return matchedCustomer?.name
      ? `${matchedCustomer.name} (${customer.customerId})`
      : customer.customerId;
  })()}
</span>git status

          <strong>{customer.ticketCount} tickets</strong>
        </div>
      ))}
    </div>

    <summary>
      <span className="show-more-label">
        Show {metrics.repeatContactCustomerList.length - 3} more
      </span>

      <span className="show-less-label">
        Show less
      </span>
    </summary>
  </details>
)}
</div>

  <p className="trust-note">
    Proxy signal: customers with 2+ tickets in the selected period.
    Multiple tickets do not necessarily mean the same underlying issue.
  </p>
</section>


      <section className="product-pattern-card">

  <div className="panel-heading">

    <div>

      <span className="eyebrow">PRODUCT PATTERNS</span>

      <h2>Products linked to SLA pressure</h2>

    </div>

    <span className="panel-note">

      Selected period · Top 5 by SLA breaches

    </span>

  </div>

  {metrics.productPatterns.length === 0 ? (

    <p className="empty-state">

      No product-level ticket pattern is available for this period.

    </p>

  ) : (

    <div className="product-pattern-list">

      {metrics.productPatterns.map((product) => (

        <div

          className="product-pattern-row"

          key={product.productSku}

        >

          <div>

            <strong>{product.productSku}</strong>

            <span>

              {product.ticketCount.toLocaleString("en-IN")} tickets

            </span>

          </div>

          <div className="product-pattern-stats">

            <span>{product.breachCount} SLA breaches</span>

            <strong>

              {(product.breachRate * 100).toFixed(1)}%

            </strong>

          </div>

        </div>

      ))}

    </div>

  )}

</section>

<section className="trust-panel">

  <div className="panel-heading">

    <div>

      <span className="eyebrow">DATA QUALITY & TRUST</span>

      <h2>How this dashboard validates the numbers</h2>

    </div>

    <span className="panel-note">

      Deterministic calculations from the support export

    </span>

  </div>

  <div className="trust-grid">

    <div className="trust-item">

      <span>Raw rows</span>

      <strong>

        {metrics.rawTicketCount.toLocaleString("en-IN")}

      </strong>

    </div>

    <div className="trust-item">

      <span>Unique tickets</span>

      <strong>

        {metrics.uniqueTicketCount.toLocaleString("en-IN")}

      </strong>

    </div>

    <div className="trust-item">

      <span>Duplicate rows removed</span>

      <strong>

        {metrics.duplicateRowsRemoved.toLocaleString("en-IN")}

      </strong>

    </div>

    <div className="trust-item">

      <span>CSAT responses</span>

      <strong>

        {metrics.csatResponses.toLocaleString("en-IN")}

      </strong>

    </div>

  </div>

  <p className="trust-note">

    Ticket counts, SLA calculations, transfers, CSAT and

    leaderboard totals are calculated deterministically from the

    deduplicated dataset. Duplicate IDs prefer the helpdesk record

    over legacy imports.

  </p>

</section>

      <section className="panel leaderboard-panel">

        <div className="panel-heading">

          <div>

            <span className="eyebrow">

              TIER 1 VOLUME LEADERBOARD

            </span>

            <h2>Tickets closed by agent</h2>

          </div>

          <p className="panel-note">

            Tier 2 agents excluded by policy. Auto-closed

            tickets shown separately.

          </p>

        </div>

        {metrics.leaderboard.length === 0 ? (

          <p className="empty-state">

            No Tier 1 ticket closures were recorded for this

            period.

          </p>

        ) : (

          <div className="table-wrap">

            <table>

              <thead>

                <tr>

                  <th>Rank</th>

                  <th>Agent</th>

                  <th>Team</th>

                  <th>Shift</th>

                  <th>Resolved</th>

                  <th>Auto-closed</th>

                  <th>Total closed</th>

                </tr>

              </thead>

              <tbody>

                {metrics.leaderboard.map((agent, index) => (

                  <tr key={agent.agentId}>

                    <td>

                      <span className="rank-badge">

                        {index + 1}

                      </span>

                    </td>

                    <td>

                      <strong>{agent.agentName}</strong>

                      <span className="table-id">

                        {agent.agentId}

                      </span>

                    </td>

                    <td>{agent.team}</td>

                    <td>{agent.shift}</td>

                    <td>{agent.resolvedTickets}</td>

                    <td>{agent.autoClosedTickets}</td>

                    <td>

                      <strong>{agent.ticketsClosed}</strong>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

          </div>

        )}

      </section>

      <footer className="data-footer">

        <span>

          Data quality:{" "}

          {metrics.rawTicketCount.toLocaleString("en-IN")} raw

          rows,{" "}

          {metrics.uniqueTicketCount.toLocaleString("en-IN")}{" "}

          unique ticket IDs.

        </span>

        <span>

          {metrics.duplicateRowsRemoved.toLocaleString("en-IN")}{" "}

          legacy/current duplicate rows removed using the

          documented source-system rule.

        </span>

      </footer>

    </main>

  );

}

export default App;