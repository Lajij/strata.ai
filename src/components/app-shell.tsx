"use client"

import * as React from "react"
import { LogOut, Menu, Plus } from "lucide-react"

import type { NavKey } from "@/lib/types"
import { useAppStore } from "@/components/app-store"
import { SidebarNav } from "@/components/sidebar-nav"
import { BuildingAssistant } from "@/components/assistant/building-assistant"
import { CreateCardDialog } from "@/components/cards/create-card-dialog"
import { CardDetailDrawer } from "@/components/cards/card-detail-drawer"
import { DashboardPage } from "@/components/pages/dashboard-page"
import { CardsPage } from "@/components/pages/cards-page"
import { VotesPage } from "@/components/pages/votes-page"
import { UpdatesPage } from "@/components/pages/updates-page"
import { DocumentsPage } from "@/components/pages/documents-page"
import { ProjectsPage } from "@/components/pages/projects-page"
import { BudgetPage } from "@/components/pages/budget-page"
import { SearchPage } from "@/components/pages/search-page"
import { PeoplePage } from "@/components/pages/people-page"
import { SettingsPage } from "@/components/pages/settings-page"
import { Button } from "@/components/ui/button"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

const PAGE_META: Record<NavKey, { title: string; description: string }> = {
  dashboard: {
    title: "Dashboard",
    description: "What needs your attention across the building today.",
  },
  cards: {
    title: "Cards",
    description: "Create, publish and manage updates and votes.",
  },
  votes: {
    title: "Votes",
    description: "Track building decisions and participation.",
  },
  updates: {
    title: "Updates",
    description: "Announcements and notices for residents.",
  },
  documents: {
    title: "Documents",
    description: "Building files, records and reports.",
  },
  projects: {
    title: "Projects",
    description: "Scope, progress, cost position and evidence for active works.",
  },
  budget: {
    title: "Budget",
    description: "Budget lines, recommendations and vendor records.",
  },
  search: {
    title: "Search",
    description: "Find RLS-visible records with source traceability.",
  },
  people: {
    title: "People",
    description: "Residents, owners and committee members.",
  },
  settings: {
    title: "Settings",
    description: "Read-only session and workspace source details.",
  },
}

function PageContent({ page }: { page: NavKey }) {
  switch (page) {
    case "dashboard":
      return <DashboardPage />
    case "cards":
      return <CardsPage />
    case "votes":
      return <VotesPage />
    case "updates":
      return <UpdatesPage />
    case "documents":
      return <DocumentsPage />
    case "projects":
      return <ProjectsPage />
    case "budget":
      return <BudgetPage />
    case "search":
      return <SearchPage />
    case "people":
      return <PeoplePage />
    case "settings":
      return <SettingsPage />
  }
}

export function AppShell() {
  const {
    currentMember,
    page,
    refreshData,
    refreshStatus,
    setCreateOpen,
    sourceDetail,
  } = useAppStore()
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
  const [isSigningOut, setIsSigningOut] = React.useState(false)
  const pageHeadingRef = React.useRef<HTMLHeadingElement>(null)
  const previousPageRef = React.useRef(page)
  const mobileNavigationPendingFocusRef = React.useRef(false)
  const meta = PAGE_META[page]

  React.useEffect(() => {
    if (previousPageRef.current !== page) {
      if (!mobileNavigationPendingFocusRef.current) {
        pageHeadingRef.current?.focus()
      }
      previousPageRef.current = page
    }
  }, [page])

  async function signOut() {
    const supabase = getSupabaseBrowserClient()

    if (!supabase) return

    setIsSigningOut(true)
    try {
      await supabase.auth.signOut()
      await refreshData()
    } finally {
      setIsSigningOut(false)
    }
  }

  async function signOutFromMobileNav() {
    setMobileNavOpen(false)
    await signOut()
  }

  function closeMobileNavAfterNavigation() {
    mobileNavigationPendingFocusRef.current = true
    setMobileNavOpen(false)
  }

  function finishMobileNavTransition(open: boolean) {
    if (!open && mobileNavigationPendingFocusRef.current) {
      mobileNavigationPendingFocusRef.current = false
      pageHeadingRef.current?.focus()
    }
  }

  return (
    <div className="flex h-svh w-full overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[100] -translate-y-24 rounded-lg bg-background px-4 py-3 font-medium text-foreground shadow-lg outline-none ring-2 ring-ring transition-transform focus:translate-y-0"
      >
        Skip to main content
      </a>
      <aside className="hidden w-64 shrink-0 border-r border-sidebar-border md:block">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border bg-card/60 px-4 py-3 backdrop-blur md:px-6">
          <Sheet
            open={mobileNavOpen}
            onOpenChange={setMobileNavOpen}
            onOpenChangeComplete={finishMobileNavTransition}
          >
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="md:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarNav
                onNavigate={closeMobileNavAfterNavigation}
                onSignOut={currentMember ? signOutFromMobileNav : undefined}
                isSigningOut={isSigningOut}
              />
            </SheetContent>
          </Sheet>

          <div className="min-w-0 flex-1">
            <h1
              ref={pageHeadingRef}
              tabIndex={-1}
              className="truncate font-serif text-lg font-semibold leading-tight outline-none"
            >
              {meta.title}
            </h1>
            <p className="hidden truncate text-sm text-muted-foreground sm:block">
              {meta.description}
            </p>
            <p className="hidden truncate text-xs text-muted-foreground lg:block">
              {sourceDetail} · {refreshStatus}
            </p>
          </div>

          {currentMember ? (
            <div className="hidden items-center gap-2 rounded-lg border bg-background px-2 py-1 md:flex">
              <span className="max-w-48 truncate text-xs text-muted-foreground">
                {currentMember.email}
              </span>
              <Button variant="ghost" size="sm" onClick={signOut} disabled={isSigningOut}>
                <LogOut data-icon="inline-start" />
                Sign out
              </Button>
            </div>
          ) : null}

          <Button onClick={() => setCreateOpen(true)}>
            <Plus data-icon="inline-start" />
            <span className="hidden sm:inline">Create card</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </header>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto outline-none">
          <div className="mx-auto w-full max-w-6xl px-4 pb-40 pt-6 md:px-6">
            <PageContent page={page} />
          </div>
        </main>
      </div>

      <BuildingAssistant />
      <CreateCardDialog />
      <CardDetailDrawer />
    </div>
  )
}
