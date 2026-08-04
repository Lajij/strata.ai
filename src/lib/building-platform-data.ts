import type { StrataAppData } from "@/lib/strata-app-data";
import type {
  ActivityItem,
  Audience,
  BuildingArea,
  Card,
  DocItem,
  Person,
  UpdateCard,
  VoteCard,
  VoteStatus,
} from "@/lib/types";
import type {
  AuditEvent,
  CardStatus,
  CardType as StrataCardType,
  GovernanceCard,
  Member,
  Visibility,
} from "@/lib/strata-data";

export interface BuildingPlatformData {
  buildingName: string;
  currentUser: {
    name: string;
    initials: string;
    role: string;
  };
  cards: Card[];
  documents: DocItem[];
  people: Person[];
  activity: ActivityItem[];
}

export function mapStrataDataToBuildingPlatform(data: StrataAppData): BuildingPlatformData {
  const people = data.members.map(mapMember);
  const documents = data.documents.map((document) => ({
    id: document.id,
    sourceRefs: document.sourceRefs?.length
      ? document.sourceRefs
      : [`document:${document.id}`, ...document.citations],
    name: document.name,
    category: document.type,
    extractionStatus: document.status,
    updated: toIsoDate(document.date),
    summary: document.summary,
    linkedTo: document.linkedTo,
    citations: document.citations,
  }));
  return {
    buildingName: "Strata Governance Command",
    currentUser: data.auth.member
      ? {
          name: data.auth.member.full_name,
          initials: initials(data.auth.member.full_name),
          role: titleCase(data.auth.member.role),
        }
      : {
          name: data.source === "fallback" ? "Demo manager" : "Signed-out user",
          initials: data.source === "fallback" ? "DM" : "SU",
          role: data.auth.mode === "active" ? "Committee" : "Preview mode",
        },
    cards: data.cards.map((card) => mapGovernanceCard(card, people.length || 1)),
    documents,
    people,
    activity: data.activity.map(mapActivity),
  };
}

function mapGovernanceCard(card: GovernanceCard, eligibleCount: number): Card {
  if (isVoteCard(card)) {
    return mapVoteCard(card, eligibleCount);
  }

  return mapUpdateCard(card);
}

function isVoteCard(card: GovernanceCard) {
  return card.status === "Pending vote" || card.proposal.id || card.proposal.votes.yes + card.proposal.votes.no > 0;
}

function mapVoteCard(card: GovernanceCard, eligibleCount: number): VoteCard {
  const votes = card.proposal.votes;
  const participation = votes.yes + votes.no + votes.abstain;

  return {
    id: card.id,
    sourceRefs: card.sourceRefs?.length ? card.sourceRefs : [`card:${card.id}`],
    proposalTitle: card.proposal.id ? card.proposal.title : undefined,
    approvalConditions: card.proposal.conditions,
    audit: card.audit.map(mapActivity),
    type: "vote",
    title: card.proposal.title || card.title,
    area: inferArea(card.type, `${card.title} ${card.description} ${card.linkedProject ?? ""}`),
    status: voteStatus(card.status, card.proposal.closes),
    deadline: toIsoDate(card.proposal.closes),
    description: card.description,
    participation,
    eligibleCount: Math.max(eligibleCount, participation, 1),
    options: [
      { id: "yes", label: "Yes", votes: votes.yes },
      { id: "no", label: "No", votes: votes.no },
      { id: "abstain", label: "Abstain", votes: votes.abstain },
    ],
    resultsHidden: card.status === "Pending vote",
    userVoted: false,
    audience: audienceForVisibility(card.visibility),
    eligibility: card.proposal.majority || "Committee voting rules apply",
    comments: card.messages.map((message, index) => ({
      id: `${card.id}-comment-${index}`,
      author: message.author,
      initials: initials(message.author),
      body: message.body,
      date: toIsoDate(message.time),
    })),
    createdAt: toIsoDate(card.updated),
  };
}

function mapUpdateCard(card: GovernanceCard): UpdateCard {
  return {
    id: card.id,
    sourceRefs: card.sourceRefs?.length ? card.sourceRefs : [`card:${card.id}`],
    proposalTitle: card.proposal.id ? card.proposal.title : undefined,
    approvalConditions: card.proposal.conditions,
    audit: card.audit.map(mapActivity),
    type: "update",
    title: card.title,
    area: inferArea(card.type, `${card.title} ${card.description} ${card.linkedProject ?? ""}`),
    status: updateStatus(card.status),
    publishDate: toIsoDate(card.updated),
    summary: card.description,
    body: [card.description, card.aiBrief].filter(Boolean).join("\n\n"),
    audience: audienceForVisibility(card.visibility),
    commentCount: card.messages.length,
    attachments: card.documents,
    comments: card.messages.map((message, index) => ({
      id: `${card.id}-comment-${index}`,
      author: message.author,
      initials: initials(message.author),
      body: message.body,
      date: toIsoDate(message.time),
    })),
    createdAt: toIsoDate(card.updated),
  };
}

function mapMember(member: Member): Person {
  return {
    id: member.id,
    name: member.name,
    initials: initials(member.name),
    contextLabel: member.access ? `Access: ${member.access}` : "Committee member",
    role: roleForMember(member.role),
    email: member.email,
  };
}

function mapActivity(event: AuditEvent, index: number): ActivityItem {
  const actor = event.actor || "System";
  const fallbackId = `${event.cardId ?? "activity"}-${index}`;

  return {
    id: event.id ?? fallbackId,
    sourceRef: event.id
      ? `audit_log:${event.id}`
      : event.cardId
        ? `card:${event.cardId}`
        : `fallback-activity:${index + 1}`,
    actor,
    initials: initials(actor),
    action: event.action,
    target: event.target,
    time: event.time,
  };
}

function audienceForVisibility(visibility: Visibility): Audience {
  if (visibility === "Admins only") return "Committee";
  if (visibility === "Selected members") return "Owners";
  return "All residents";
}

function roleForMember(role: string): Person["role"] {
  const normal = role.toLowerCase();
  if (normal.includes("manager") || normal.includes("admin")) return "Manager";
  if (normal.includes("committee") || normal.includes("chair") || normal.includes("treasurer")) return "Committee";
  if (normal.includes("tenant")) return "Tenant";
  if (normal.includes("owner")) return "Owner";
  return "Resident";
}

function updateStatus(status: CardStatus): UpdateCard["status"] {
  if (status === "Resolved") return "Archived";
  if (status === "Confidential") return "Draft";
  return "Published";
}

function voteStatus(status: CardStatus, closes: string): VoteStatus {
  if (status === "Resolved") return "Closed";
  if (status === "Confidential") return "Draft";
  const days = daysUntil(closes);
  if (days !== null && days <= 5) return "Closing soon";
  return "Open";
}

function inferArea(type: StrataCardType, text: string): BuildingArea {
  const value = text.toLowerCase();
  if (value.includes("lift") || value.includes("elevator")) return "Lift";
  if (value.includes("parking") || value.includes("garage") || value.includes("basement")) return "Parking";
  if (value.includes("garden") || value.includes("landscape")) return "Garden";
  if (value.includes("roof")) return "Rooftop";
  if (value.includes("pool")) return "Pool";
  if (value.includes("gym")) return "Gym";
  if (value.includes("lobby") || value.includes("foyer")) return "Lobby";
  if (type === "Budget" || type === "Meeting" || type === "Compliance") return "Strata";
  return "Building-wide";
}

function toIsoDate(value: string) {
  if (!value || value === "—") return "";
  const parsed = new Date(value.length <= 10 ? `${value}T00:00:00` : value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function daysUntil(value: string) {
  const iso = toIsoDate(value);
  if (!iso) return null;
  const target = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function titleCase(value: string) {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}
