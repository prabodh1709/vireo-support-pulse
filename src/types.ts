export type Channel = "chat" | "email" | "voice" | "social";

export type TicketStatus = "resolved" | "closed" | "open" | "pending";

export interface Ticket {
  id: string;
  createdAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  status: TicketStatus;
  channel: Channel;
  customerId: string;
  orderId: string | null;
  productSku: string;
  category: string;
  priority: string;
  assignedTeam: string;
  agentId: string;
  transfers: number;
  csatScore: number | null;
  refundAmountInr: number | null;
  refundReasonCode: string | null;
  replacementIssued: boolean;
  customerMessage: string;
  agentNotes: string;
  sourceSystem: "helpdesk" | "legacy_fd";
}

export interface Agent {
  id: string;
  name: string;
  site: string;
  team: string;
  shift: string;
  tier: "1" | "2";
  fromDate: string;
  toDate: string | null;
}

export interface Customer {
  id: string;
  name: string;
  city: string;
  state: string;
  signupDate: string;
  carePlus: boolean;
}

export interface Order {
  id: string;
  customerId: string;
  sku: string;
  orderDate: string;
  channel: string;
  quantity: number;
  orderValueInr: number;
  lotCode: string;
}

export interface Product {
  sku: string;
  name: string;
  family: string;
  launchDate: string;
  unitCostInr: number;
  retailPriceInr: number;
  warrantyMonths: number;
}

export interface SupportData {
  tickets: Ticket[];
  agents: Agent[];
  customers: Customer[];
  orders: Order[];
  products: Product[];
}