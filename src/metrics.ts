import type { Agent, SupportData, Ticket } from "./types";



export const SLA_TARGET_MINUTES = {

  chat: 15,

  voice: 120,

  social: 240,

  email: 480

} as const;



export const SLA_CREDIT_INR = 350;

export const TRANSFER_COST_INR = 305;

export interface ProductPattern {

  productSku: string;

  ticketCount: number;

  breachCount: number;

  breachRate: number;

}

export interface CategoryInsight {

  category: string;

  tickets: number;

  previousTickets: number;

  change: number;

}



export interface LeaderboardRow {

  agentId: string;

  agentName: string;

  team: string;

  shift: string;

  ticketsClosed: number;

  resolvedTickets: number;

  autoClosedTickets: number;

}



export interface RiskAlert {

  id: string;

  severity: "high" | "medium" | "low";

  title: string;

  description: string;

}



export interface DashboardMetrics {

  availableWeeks: string[];

  selectedWeek: string;



  selectedStartDate: string;

  selectedEndDate: string;

  previousStartDate: string;

  previousEndDate: string;



  rawTicketCount: number;

  uniqueTicketCount: number;

  duplicateRowsRemoved: number;

  productPatterns: ProductPattern[];



  ticketsCreated: number;

  ticketsResolvedOrClosed: number;



  slaBreaches: number;

  slaBreachRate: number;

  slaCreditCost: number;



  transferCount: number;

  transferCost: number;



  averageCsat: number | null;

  csatResponses: number;
  repeatContactCustomers: number;
  uniqueCustomers: number;
  repeatContactRate: number;
  repeatContactCustomerList: Array<{
  customerId: string;
  customerName: string;
  ticketCount: number;
}>;
  



  topCategories: CategoryInsight[];

  leaderboard: LeaderboardRow[];

  risks: RiskAlert[];



  currentWeekTickets: Ticket[];

}



function parseTimestamp(value: string | null): Date | null {

  if (!value) return null;



  const parsed = new Date(value.replace(" ", "T"));



  return Number.isNaN(parsed.getTime()) ? null : parsed;

}



function dateKey(date: Date): string {

  const year = date.getFullYear();

  const month = String(date.getMonth() + 1).padStart(2, "0");

  const day = String(date.getDate()).padStart(2, "0");



  return `${year}-${month}-${day}`;

}



function addDays(value: string, days: number): string {

  const date = new Date(`${value}T12:00:00`);

  date.setDate(date.getDate() + days);



  return dateKey(date);

}



function daysInclusive(start: string, end: string): number {

  const startDate = new Date(`${start}T12:00:00`);

  const endDate = new Date(`${end}T12:00:00`);



  return (

    Math.round(

      (endDate.getTime() - startDate.getTime()) / 86_400_000

    ) + 1

  );

}



function dateInRange(

  timestamp: string | null,

  startDate: string,

  endDate: string

): boolean {

  const parsed = parseTimestamp(timestamp);



  if (!parsed) return false;



  const key = dateKey(parsed);



  return key >= startDate && key <= endDate;

}



function responseMinutes(ticket: Ticket): number | null {

  const created = parseTimestamp(ticket.createdAt);

  const firstResponse = parseTimestamp(ticket.firstResponseAt);



  if (!created || !firstResponse) return null;



  return Math.max(

    0,

    Math.round(

      (firstResponse.getTime() - created.getTime()) / 60_000

    )

  );

}



function isSlaBreach(ticket: Ticket): boolean {

  const minutes = responseMinutes(ticket);



  if (minutes === null) return false;



  return minutes > SLA_TARGET_MINUTES[ticket.channel];

}



function isResolvedOrClosed(ticket: Ticket): boolean {

  return ticket.status === "resolved" || ticket.status === "closed";

}



/**

 * Legacy tickets can be re-imported.

 * For duplicate ticket IDs, prefer the current helpdesk record.

 */

export function deduplicateTickets(tickets: Ticket[]): Ticket[] {

  const uniqueTickets = new Map<string, Ticket>();



  for (const ticket of tickets) {

    const existing = uniqueTickets.get(ticket.id);



    if (!existing || ticket.sourceSystem === "helpdesk") {

      uniqueTickets.set(ticket.id, ticket);

    }

  }



  return Array.from(uniqueTickets.values());

}



function groupCategories(tickets: Ticket[]): Map<string, number> {

  const counts = new Map<string, number>();



  for (const ticket of tickets) {

    const category = ticket.category || "Other";



    counts.set(category, (counts.get(category) ?? 0) + 1);

  }



  return counts;

}



function createCategoryInsights(

  currentTickets: Ticket[],

  previousTickets: Ticket[]

): CategoryInsight[] {

  const currentCounts = groupCategories(currentTickets);

  const previousCounts = groupCategories(previousTickets);



  return Array.from(currentCounts.entries())

    .map(([category, tickets]) => {

      const previousTicketCount = previousCounts.get(category) ?? 0;



      return {

        category,

        tickets,

        previousTickets: previousTicketCount,

        change: tickets - previousTicketCount

      };

    })

    .sort((first, second) => {

      if (second.change !== first.change) {

        return second.change - first.change;

      }



      return second.tickets - first.tickets;

    })

    .slice(0, 6);

}



function createLeaderboard(

  closedTickets: Ticket[],

  agents: Agent[]

): LeaderboardRow[] {

  const agentsById = new Map(

    agents.map((agent) => [agent.id, agent])

  );



  const rows = new Map<string, LeaderboardRow>();



  for (const ticket of closedTickets) {

    const agent = agentsById.get(ticket.agentId);



    // Tier 2 is intentionally excluded.

    if (!agent || agent.tier !== "1") {

      continue;

    }



    const existing = rows.get(agent.id) ?? {

      agentId: agent.id,

      agentName: agent.name,

      team: agent.team,

      shift: agent.shift,

      ticketsClosed: 0,

      resolvedTickets: 0,

      autoClosedTickets: 0

    };



    existing.ticketsClosed += 1;



    if (ticket.status === "closed") {

      existing.autoClosedTickets += 1;

    } else {

      existing.resolvedTickets += 1;

    }



    rows.set(agent.id, existing);

  }



  return Array.from(rows.values()).sort(

    (first, second) => second.ticketsClosed - first.ticketsClosed

  );

}



function createRisks(

  ticketsInRange: Ticket[],

  allTickets: Ticket[],

  transferCount: number,

  slaBreaches: number,

  startDate: string,

  endDate: string

): RiskAlert[] {

  const risks: RiskAlert[] = [];



  const orderIdsInRange = new Set(

    ticketsInRange

      .map((ticket) => ticket.orderId)

      .filter((orderId): orderId is string => Boolean(orderId))

  );



  const refundOrders = new Set(

    allTickets

      .filter(

        (ticket) =>

          ticket.orderId &&

          ticket.refundAmountInr !== null &&

          orderIdsInRange.has(ticket.orderId)

      )

      .map((ticket) => ticket.orderId)

  );



  const replacementOrders = new Set(

    allTickets

      .filter(

        (ticket) =>

          ticket.orderId &&

          ticket.replacementIssued === true &&

          orderIdsInRange.has(ticket.orderId)

      )

      .map((ticket) => ticket.orderId)

  );



  const doubleRemedyOrders = Array.from(refundOrders).filter(

    (orderId) => replacementOrders.has(orderId)

  );



  if (doubleRemedyOrders.length > 0) {

    risks.push({

      id: "refund-replacement",

      severity: "high",

      title: `${doubleRemedyOrders.length} refund + replacement policy risk${

        doubleRemedyOrders.length === 1 ? "" : "s"

      }`,

      description:

        "One or more orders have both a refund and a replacement across their support tickets. Review these orders immediately."

    });

  }



  if (slaBreaches > 0) {

    risks.push({

      id: "sla-breaches",

      severity: "medium",

      title: `${slaBreaches} SLA breach${

        slaBreaches === 1 ? "" : "es"

      } in selected period`,

      description: `Late first responses create ₹${SLA_CREDIT_INR} store-credit cost per breached ticket.`

    });

  }



  if (transferCount > 0) {

    risks.push({

      id: "transfers",

      severity: "low",

      title: `${transferCount} team hand-off${

        transferCount === 1 ? "" : "s"

      } in selected period`,

      description: `Each hand-off has a planning cost of ₹${TRANSFER_COST_INR}. Review frequent-routing categories.`

    });

  }



  if (risks.length === 0) {

    risks.push({

      id: "no-critical-risks",

      severity: "low",

      title: "No policy risks detected",

      description: `No refund-plus-replacement conflict, recorded SLA breach, or transfer was found from ${formatWeekLabel(

        startDate

      )} to ${formatWeekLabel(endDate)}.`

    });

  }



  return risks;

}



// Kept temporarily for compatibility with the existing App.tsx.

export function getAvailableWeeks(tickets: Ticket[]): string[] {

  return Array.from(

    new Set(

      tickets

        .map((ticket) => {

          const date = parseTimestamp(ticket.createdAt);

          return date ? dateKey(date) : null;

        })

        .filter((value): value is string => value !== null)

    )

  ).sort((first, second) => second.localeCompare(first));

}



export function formatWeekLabel(value: string): string {

  const date = new Date(`${value}T12:00:00`);



  if (Number.isNaN(date.getTime())) {

    return value;

  }



  return date.toLocaleDateString("en-IN", {

    day: "numeric",

    month: "short",

    year: "numeric"

  });

}



export function formatInr(amount: number): string {

  return new Intl.NumberFormat("en-IN", {

    style: "currency",

    currency: "INR",

    maximumFractionDigits: 0

  }).format(amount);

}

function buildProductPatterns(

  tickets: Ticket[],

  startDate: string,

  endDate: string

): ProductPattern[] {

  const grouped = new Map<

    string,

    { ticketCount: number; breachCount: number }

  >();



  tickets

    .filter(

      (ticket) =>

        ticket.createdAt >= startDate &&

        ticket.createdAt <= `${endDate}T23:59:59`

    )

    .forEach((ticket) => {

      const sku = ticket.productSku?.trim();



      if (!sku) return;



      const current = grouped.get(sku) ?? {

        ticketCount: 0,

        breachCount: 0,

      };



      current.ticketCount += 1;



      if (isSlaBreach(ticket)) {

        current.breachCount += 1;

      }



      grouped.set(sku, current);

    });



  return Array.from(grouped.entries())

    .map(([productSku, values]) => ({

      productSku,

      ticketCount: values.ticketCount,

      breachCount: values.breachCount,

      breachRate:

        values.ticketCount > 0

          ? values.breachCount / values.ticketCount

          : 0,

    }))

    .sort(

      (a, b) =>

        b.breachCount - a.breachCount ||

        b.ticketCount - a.ticketCount

    )

    .slice(0, 5);

}
function createRepeatContactInsight(
  tickets: Ticket[],
  customers: SupportData["customers"]
) {
  const customerTicketCounts = new Map<string, number>();

  for (const ticket of tickets) {
    const customerId = ticket.customerId?.trim();

    if (!customerId) continue;

    customerTicketCounts.set(
      customerId,
      (customerTicketCounts.get(customerId) ?? 0) + 1
    );
  }

  const customerNameMap = new Map(
    customers.map((customer) => [customer.customerId, customer.name])
  );

  const uniqueCustomers = customerTicketCounts.size;

  const repeatContactCustomers = Array.from(
    customerTicketCounts.values()
  ).filter((count) => count >= 2).length;

  const repeatContactCustomerList = Array.from(
    customerTicketCounts.entries()
  )
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([customerId, ticketCount]) => ({
      customerId,
      customerName: customerNameMap.get(customerId) ?? "Unknown customer",
      ticketCount,
    }));

  return {
    repeatContactCustomers,
    uniqueCustomers,
    repeatContactRate:
      uniqueCustomers > 0
        ? repeatContactCustomers / uniqueCustomers
        : 0,
    repeatContactCustomerList,
  };
}
export function calculateDashboardMetrics(

  data: SupportData,

  requestedStartDate?: string,

  requestedEndDate?: string

): DashboardMetrics {

  const cleanTickets = deduplicateTickets(data.tickets);

  const availableDates = getAvailableWeeks(cleanTickets);

  if (availableDates.length === 0) {

    return {

      availableWeeks: [],

      selectedWeek: "",

      selectedStartDate: "",

      selectedEndDate: "",

      previousStartDate: "",

      previousEndDate: "",

      rawTicketCount: data.tickets.length,

      uniqueTicketCount: 0,

      duplicateRowsRemoved: data.tickets.length,

      ticketsCreated: 0,

      ticketsResolvedOrClosed: 0,

      slaBreaches: 0,

      slaBreachRate: 0,

      slaCreditCost: 0,

      transferCount: 0,

      transferCost: 0,

      averageCsat: null,

      csatResponses: 0,

      repeatContactCustomers: 0,
      uniqueCustomers: 0,
      repeatContactRate: 0,

      topCategories: [],

      leaderboard: [],

      risks: [],

      currentWeekTickets: [],

      productPatterns: [],



    };

  }



  const latestDate = availableDates[0];



  let selectedStartDate =

    requestedStartDate || addDays(latestDate, -6);



  let selectedEndDate =

    requestedEndDate || latestDate;



  if (selectedStartDate > selectedEndDate) {

    [selectedStartDate, selectedEndDate] = [

      selectedEndDate,

      selectedStartDate

    ];

  }



  const selectedDays = daysInclusive(

    selectedStartDate,

    selectedEndDate

  );



  // Same-length immediately preceding period.

  const previousEndDate = addDays(selectedStartDate, -1);



  const previousStartDate = addDays(

    previousEndDate,

    -(selectedDays - 1)

  );



  const currentTickets = cleanTickets.filter((ticket) =>

    dateInRange(

      ticket.createdAt,

      selectedStartDate,

      selectedEndDate

    )

  );



  const previousTickets = cleanTickets.filter((ticket) =>

    dateInRange(

      ticket.createdAt,

      previousStartDate,

      previousEndDate

    )

  );



  const closedTickets = cleanTickets.filter(

    (ticket) =>

      isResolvedOrClosed(ticket) &&

      dateInRange(

        ticket.resolvedAt,

        selectedStartDate,

        selectedEndDate

      )

  );



  const breachedTickets =

    currentTickets.filter(isSlaBreach);



  const transferCount = currentTickets.reduce(

    (total, ticket) => total + ticket.transfers,

    0

  );



  const csatScores = currentTickets

    .map((ticket) => ticket.csatScore)

    .filter(

      (score): score is number =>

        score !== null &&

        score >= 1 &&

        score <= 5

    );



  const averageCsat =

    csatScores.length === 0

      ? null

      : csatScores.reduce(

          (total, score) => total + score,

          0

        ) / csatScores.length;



  return {

    availableWeeks: availableDates,



    // Compatibility field for the current App.tsx.

    selectedWeek: selectedStartDate,



    selectedStartDate,

    selectedEndDate,

    previousStartDate,

    previousEndDate,



    rawTicketCount: data.tickets.length,

    uniqueTicketCount: cleanTickets.length,

    duplicateRowsRemoved:

      data.tickets.length - cleanTickets.length,



    ticketsCreated: currentTickets.length,

    ticketsResolvedOrClosed: closedTickets.length,



    slaBreaches: breachedTickets.length,



    slaBreachRate:

      currentTickets.length === 0

        ? 0

        : breachedTickets.length / currentTickets.length,



    slaCreditCost:

      breachedTickets.length * SLA_CREDIT_INR,



    transferCount,



    transferCost:

      transferCount * TRANSFER_COST_INR,



    averageCsat,

    csatResponses: csatScores.length,
    ...createRepeatContactInsight(currentTickets, data.customers),


    topCategories: createCategoryInsights(

      currentTickets,

      previousTickets

    ),



    leaderboard: createLeaderboard(

      closedTickets,

      data.agents

    ),



    risks: createRisks(

      currentTickets,

      cleanTickets,

      transferCount,

      breachedTickets.length,

      selectedStartDate,

      selectedEndDate

    ),



    currentWeekTickets: currentTickets,

    productPatterns: buildProductPatterns(
      cleanTickets,
      selectedStartDate,
      selectedEndDate
    )

  };

}