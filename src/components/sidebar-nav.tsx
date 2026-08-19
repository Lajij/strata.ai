"use client"

import {
  Building2,
  CircleDollarSign,
  FileText,
  FolderKanban,
  Gavel,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Search,
  Settings,
  SquareStack,
  Users,
  Vote,
} from "lucide-react"

import { cn } from "@/lib/utils"
import type { NavKey } from "@/lib/types"
import { useAppStore } from "@/components/app-store"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

const NAV_ITEMS: { key: NavKey; label: string; icon: typeof LayoutDashboard }[] =
  [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "cards", label: "Cards", icon: SquareStack },
    { key: "votes", label: "Votes", icon: Vote },
    { key: "updates", label: "Updates", icon: Megaphone },
    { key: "documents", label: "Documents", icon: FileText },
    { key: "projects", label: "Projects", icon: FolderKanban },
    { key: "budget", label: "Budget", icon: CircleDollarSign },
    { key: "search", label: "Search", icon: Search },
    { key: "people", label: "People", icon: Users },
    { key: "motions", label: "Motions", icon: Gavel },
    { key: "settings", label: "Settings", icon: Settings },
  ]

export function SidebarNav({
  onNavigate,
  onSignOut,
  isSigningOut = false,
}: {
  onNavigate?: () => void
  onSignOut?: () => void
  isSigningOut?: boolean
}) {
  const { buildingName, currentUser, page, setPage } = useAppStore()

  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex shrink-0 items-center gap-2.5 px-4 py-4">
        <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">
            {buildingName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Building management
          </p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 py-2" aria-label="Main">
        {NAV_ITEMS.map((item) => {
          const active = page === item.key
          const Icon = item.icon
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setPage(item.key)
                onNavigate?.()
              }}
              aria-label={item.key === "people" ? "Members" : item.label}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:min-h-0",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="flex shrink-0 items-center gap-3 border-t border-sidebar-border px-4 py-3">
        <Avatar className="size-8">
          <AvatarFallback className="bg-accent text-xs text-accent-foreground">
            {currentUser.initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">
            {currentUser.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {currentUser.role}
          </p>
        </div>
        {onSignOut ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Sign out"
            onClick={onSignOut}
            disabled={isSigningOut}
          >
            <LogOut />
          </Button>
        ) : null}
      </div>
    </div>
  )
}
