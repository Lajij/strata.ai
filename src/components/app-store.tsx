"use client"

import * as React from "react"

import { activity, BUILDING_NAME, documents, initialCards, people } from "@/lib/mock-data"
import { mapStrataDataToBuildingPlatform } from "@/lib/building-platform-data"
import type { BuildingPlatformData } from "@/lib/building-platform-data"
import type { StrataAppData } from "@/lib/strata-app-data"
import type { ActivityItem, Card, DocItem, NavKey, Person } from "@/lib/types"
import type { Motion } from "@/lib/strata-data"

interface AppStore {
  dataSource: StrataAppData["source"]
  buildingName: string
  currentUser: BuildingPlatformData["currentUser"]
  cards: Card[]
  people: Person[]
  documents: DocItem[]
  activity: ActivityItem[]
  rawMembers: StrataAppData["members"]
  rawProjects: StrataAppData["projects"]
  rawVendors: StrataAppData["vendors"]
  rawBudgetLines: StrataAppData["budgetLines"]
  rawBudgetRecommendation: StrataAppData["budgetRecommendation"]
  currentMember: StrataAppData["auth"]["member"]
  sourceDetail: string
  refreshStatus: string
  refreshData: () => Promise<StrataAppData | null>
  page: NavKey
  setPage: (page: NavKey) => void
  selectedCardId: string | null
  openCard: (id: string) => void
  closeCard: () => void
  createOpen: boolean
  setCreateOpen: (open: boolean) => void
  motions: Motion[]
  selectedMotionId: string | null
  openMotion: (id: string) => void
  closeMotion: () => void
  motionCreateOpen: boolean
  setMotionCreateOpen: (open: boolean) => void
  assistantOpen: boolean
  setAssistantOpen: (open: boolean) => void
}

const AppStoreContext = React.createContext<AppStore | null>(null)

async function noOpRefresh() {
  return null
}

const fallbackData: BuildingPlatformData = {
  buildingName: BUILDING_NAME,
  currentUser: {
    name: "Grace Miller",
    initials: "GM",
    role: "Building manager",
  },
  cards: initialCards,
  motions: [],
  people,
  documents,
  activity,
}

export function AppStoreProvider({
  children,
  initialData,
  onDataRefresh,
  refreshStatus = "Workspace ready",
}: {
  children: React.ReactNode
  initialData?: StrataAppData
  onDataRefresh?: () => Promise<StrataAppData | null>
  refreshStatus?: string
}) {
  const platformData = React.useMemo(
    () => (initialData ? mapStrataDataToBuildingPlatform(initialData) : fallbackData),
    [initialData],
  )
  const [cards, setCards] = React.useState<Card[]>(platformData.cards)
  const [motions, setMotions] = React.useState<Motion[]>(platformData.motions)
  const [page, setPage] = React.useState<NavKey>("dashboard")
  const [selectedCardId, setSelectedCardId] = React.useState<string | null>(null)
  const [createOpen, setCreateOpen] = React.useState(false)
  const [selectedMotionId, setSelectedMotionId] = React.useState<string | null>(null)
  const [motionCreateOpen, setMotionCreateOpen] = React.useState(false)
  const [assistantOpen, setAssistantOpen] = React.useState(false)

  const refreshData = React.useCallback(async () => {
    const nextData = await (onDataRefresh ?? noOpRefresh)()

    if (nextData) {
      const refreshed = mapStrataDataToBuildingPlatform(nextData)
      setCards(refreshed.cards)
      setMotions(refreshed.motions)
      setSelectedCardId((currentId) =>
        currentId && refreshed.cards.some((card) => card.id === currentId) ? currentId : null,
      )
      setSelectedMotionId((currentId) =>
        currentId && refreshed.motions.some((motion) => motion.id === currentId) ? currentId : null,
      )
    }

    return nextData
  }, [onDataRefresh])

  const openCard = React.useCallback((id: string) => setSelectedCardId(id), [])
  const closeCard = React.useCallback(() => setSelectedCardId(null), [])
  const openMotion = React.useCallback((id: string) => setSelectedMotionId(id), [])
  const closeMotion = React.useCallback(() => setSelectedMotionId(null), [])

  const value = React.useMemo<AppStore>(
    () => ({
      dataSource: initialData?.source ?? "fallback",
      buildingName: platformData.buildingName,
      currentUser: platformData.currentUser,
      cards,
      motions,
      people: platformData.people,
      documents: platformData.documents,
      activity: platformData.activity,
      rawMembers: initialData?.members ?? [],
      rawProjects: initialData?.projects ?? [],
      rawVendors: initialData?.vendors ?? [],
      rawBudgetLines: initialData?.budgetLines ?? [],
      rawBudgetRecommendation: initialData?.budgetRecommendation ?? {
        summary: "",
        citations: [],
        disclaimer: "",
      },
      currentMember: initialData?.auth.member ?? null,
      sourceDetail: initialData?.sourceDetail ?? "Seeded local data",
      refreshStatus,
      refreshData,
      page,
      setPage,
      selectedCardId,
      openCard,
      closeCard,
      createOpen,
      setCreateOpen,
      selectedMotionId,
      openMotion,
      closeMotion,
      motionCreateOpen,
      setMotionCreateOpen,
      assistantOpen,
      setAssistantOpen,
    }),
    [
      platformData,
      initialData,
      refreshData,
      refreshStatus,
      cards,
      motions,
      page,
      selectedCardId,
      openCard,
      closeCard,
      createOpen,
      selectedMotionId,
      openMotion,
      closeMotion,
      motionCreateOpen,
      assistantOpen,
    ],
  )

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  )
}

export function useAppStore() {
  const ctx = React.useContext(AppStoreContext)
  if (!ctx) throw new Error("useAppStore must be used within AppStoreProvider")
  return ctx
}
