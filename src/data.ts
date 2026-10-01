import type {
  Agent,
  Customer,
  Order,
  Product,
  SupportData,
  Ticket
} from "./types";

type CsvRow = Record<string, string>;

export const REQUIRED_FILES = [
  "tickets.csv",
  "agents.csv",
  "customers.csv",
  "orders.csv",
  "products.csv"
] as const;

function emptyToNull(value: string | undefined): string | null {
  const cleaned = value?.trim() ?? "";
  return cleaned === "" ? null : cleaned;
}

function toNumber(value: string | undefined): number {
  const parsed = Number(value?.trim() ?? "0");
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: string | undefined): number | null {
  const cleaned = value?.trim() ?? "";
  if (cleaned === "") return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value: string | undefined): boolean {
  return value?.trim().toUpperCase() === "Y";
}

function asChannel(value: string): Ticket["channel"] {
  if (value === "chat" || value === "email" || value === "voice" || value === "social") {
    return value;
  }

  return "email";
}

function asStatus(value: string): Ticket["status"] {
  if (value === "resolved" || value === "closed" || value === "open" || value === "pending") {
    return value;
  }

  return "open";
}

/**
 * Parses CSV safely, including commas, quotes, and multiline ticket messages.
 */
export function parseCsv(text: string): CsvRow[] {
  const table: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const nextCharacter = text[index + 1];

    if (insideQuotes) {
      if (character === '"' && nextCharacter === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        insideQuotes = false;
      } else {
        cell += character;
      }

      continue;
    }

    if (character === '"') {
      insideQuotes = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell);

      if (row.some((value) => value.trim() !== "")) {
        table.push(row);
      }

      row = [];
      cell = "";
    } else if (character !== "\r") {
      cell += character;
    }
  }

  if (cell !== "" || row.length > 0) {
    row.push(cell);

    if (row.some((value) => value.trim() !== "")) {
      table.push(row);
    }
  }

  if (table.length === 0) {
    return [];
  }

  const headers = table[0].map((header, index) => {
    const withoutBom = index === 0 ? header.replace(/^\uFEFF/, "") : header;
    return withoutBom.trim();
  });

  return table
    .slice(1)
    .filter((values) => values.some((value) => value.trim() !== ""))
    .map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index]?.trim() ?? ""])
      )
    );
}

function mapTicket(row: CsvRow): Ticket {
  return {
    id: row.ticket_id,
    createdAt: row.created_at,
    firstResponseAt: emptyToNull(row.first_response_at),
    resolvedAt: emptyToNull(row.resolved_at),
    status: asStatus(row.status),
    channel: asChannel(row.channel),
    customerId: row.customer_id,
    orderId: emptyToNull(row.order_id),
    productSku: row.product_sku,
    category: row.category || "Other",
    priority: row.priority || "Normal",
    assignedTeam: row.assigned_team,
    agentId: row.agent_id,
    transfers: toNumber(row.transfers),
    csatScore: toNullableNumber(row.csat_score),
    refundAmountInr: toNullableNumber(row.refund_amount_inr),
    refundReasonCode: emptyToNull(row.refund_reason_code),
    replacementIssued: toBoolean(row.replacement_issued),
    customerMessage: row.customer_message ?? "",
    agentNotes: row.agent_notes ?? "",
    sourceSystem: row.source_system === "legacy_fd" ? "legacy_fd" : "helpdesk"
  };
}

function mapAgent(row: CsvRow): Agent {
  return {
    id: row.agent_id,
    name: row.name,
    site: row.site,
    team: row.team,
    shift: row.shift,
    tier: row.tier === "2" ? "2" : "1",
    fromDate: row.from_date,
    toDate: emptyToNull(row.to_date)
  };
}

function mapCustomer(row: CsvRow): Customer {
  return {
    id: row.customer_id,
    name: row.name,
    city: row.city,
    state: row.state,
    signupDate: row.signup_date,
    carePlus: toBoolean(row.care_plus)
  };
}

function mapOrder(row: CsvRow): Order {
  return {
    id: row.order_id,
    customerId: row.customer_id,
    sku: row.sku,
    orderDate: row.order_date,
    channel: row.channel,
    quantity: toNumber(row.qty),
    orderValueInr: toNumber(row.order_value_inr),
    lotCode: row.lot_code
  };
}

function mapProduct(row: CsvRow): Product {
  return {
    sku: row.sku,
    name: row.product_name,
    family: row.family,
    launchDate: row.launch_date,
    unitCostInr: toNumber(row.unit_cost_inr),
    retailPriceInr: toNumber(row.retail_price_inr),
    warrantyMonths: toNumber(row.warranty_months)
  };
}

function buildSupportData(
  ticketRows: CsvRow[],
  agentRows: CsvRow[],
  customerRows: CsvRow[],
  orderRows: CsvRow[],
  productRows: CsvRow[]
): SupportData {
  return {
    tickets: ticketRows.map(mapTicket),
    agents: agentRows.map(mapAgent),
    customers: customerRows.map(mapCustomer),
    orders: orderRows.map(mapOrder),
    products: productRows.map(mapProduct)
  };
}

async function fetchCsv(path: string): Promise<CsvRow[]> {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Could not load ${path}. Check that the file exists.`);
  }

  return parseCsv(await response.text());
}

export async function loadBundledData(): Promise<SupportData> {
  const [ticketRows, agentRows, customerRows, orderRows, productRows] =
    await Promise.all([
      fetchCsv("/data/tickets.csv"),
      fetchCsv("/data/agents.csv"),
      fetchCsv("/data/customers.csv"),
      fetchCsv("/data/orders.csv"),
      fetchCsv("/data/products.csv")
    ]);

  return buildSupportData(
    ticketRows,
    agentRows,
    customerRows,
    orderRows,
    productRows
  );
}

async function readUploadedCsv(
  filesByName: Map<string, File>,
  fileName: string
): Promise<CsvRow[]> {
  const file = filesByName.get(fileName);

  if (!file) {
    throw new Error(`Missing required file: ${fileName}`);
  }

  return parseCsv(await file.text());
}

export async function loadReplacementData(
  selectedFiles: FileList | File[]
): Promise<SupportData> {
  const filesByName = new Map(
    Array.from(selectedFiles).map((file) => [file.name.toLowerCase(), file])
  );

  const [ticketRows, agentRows, customerRows, orderRows, productRows] =
    await Promise.all([
      readUploadedCsv(filesByName, "tickets.csv"),
      readUploadedCsv(filesByName, "agents.csv"),
      readUploadedCsv(filesByName, "customers.csv"),
      readUploadedCsv(filesByName, "orders.csv"),
      readUploadedCsv(filesByName, "products.csv")
    ]);

  return buildSupportData(
    ticketRows,
    agentRows,
    customerRows,
    orderRows,
    productRows
  );
}