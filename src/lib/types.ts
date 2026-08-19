export type NavKey =
  | "dashboard"
  | "cards"
  | "votes"
  | "updates"
  | "documents"
  | "projects"
  | "budget"
  | "search"
  | "people"
  | "settings"
  | "motions"

export type BuildingArea =
  | "Lobby"
  | "Lift"
  | "Strata"
  | "Parking"
  | "Garden"
  | "Rooftop"
  | "Pool"
  | "Gym"
  | "Building-wide"

export type Audience =
  | "All residents"
  | "Owners"
  | "Committee"
  | "Tenants"

export type UpdateStatus = "Draft" | "Scheduled" | "Published" | "Archived"
export type VoteStatus = "Open" | "Closing soon" | "Closed" | "Draft"

export type CardType = "update" | "vote"

interface WorkflowCardFields {
  proposalTitle?: string
  approvalConditions?: string[]
  audit?: ActivityItem[]
}

export interface Comment {
  id: string
  author: string
  initials: string
  body: string
  date: string
}

export interface UpdateCard extends WorkflowCardFields {
  id: string
  sourceRefs?: string[]
  type: "update"
  title: string
  area: BuildingArea
  status: UpdateStatus
  publishDate: string
  summary: string
  body: string
  audience: Audience
  commentCount: number
  attachments: string[]
  comments: Comment[]
  createdAt: string
}

export interface VoteOption {
  id: string
  label: string
  votes: number
}

export interface VoteCard extends WorkflowCardFields {
  id: string
  sourceRefs?: string[]
  type: "vote"
  title: string
  area: BuildingArea
  status: VoteStatus
  deadline: string
  description: string
  participation: number
  eligibleCount: number
  options: VoteOption[]
  resultsHidden: boolean
  userVoted: boolean
  audience: Audience
  eligibility: string
  comments?: Comment[]
  createdAt: string
}

export type Card = UpdateCard | VoteCard

export type CardTab = "all" | "updates" | "votes" | "drafts"
export type ViewMode = "grid" | "list"

export interface Person {
  id: string
  name: string
  initials: string
  contextLabel: string
  role: "Resident" | "Owner" | "Committee" | "Manager" | "Tenant"
  email: string
}

export interface DocItem {
  id: string
  sourceRefs?: string[]
  name: string
  category: string
  fileSize?: string
  extractionStatus: string
  updated: string
  summary?: string
  linkedTo?: string[]
  citations?: string[]
}

export interface ActivityItem {
  id: string
  sourceRef: string
  actor: string
  initials: string
  action: string
  target: string
  time: string
}

export interface AssistantSource {
  label: string
  snippet: string
  nav?: NavKey
}
