"use client"

import * as React from "react"
import { Check, Mail, Search, ShieldCheck, UserPlus } from "lucide-react"

import type { Member } from "@/lib/strata-data"
import type { Person } from "@/lib/types"
import { authHeaders } from "@/lib/supabase/auth-headers"
import { useAppStore } from "@/components/app-store"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

const roleVariant: Record<Person["role"], "default" | "secondary" | "outline"> = {
  Committee: "default",
  Manager: "default",
  Owner: "secondary",
  Resident: "outline",
  Tenant: "outline",
}

export function PeoplePage() {
  const { currentMember, people, rawMembers, refreshData } = useAppStore()
  const [query, setQuery] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [fullName, setFullName] = React.useState("")
  const [role, setRole] = React.useState("member")
  const [accessLevel, setAccessLevel] = React.useState("member")
  const [inviteStatus, setInviteStatus] = React.useState("Invite form ready")
  const [isInviting, setIsInviting] = React.useState(false)
  const canManage = Boolean(
    currentMember && ["admin", "chair", "secretary"].includes(currentMember.role),
  )

  const filtered = people.filter((p) =>
    `${p.name} ${p.contextLabel} ${p.role}`.toLowerCase().includes(query.toLowerCase()),
  )

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!canManage) {
      setInviteStatus("Only admin, chair, or secretary members can invite users")
      return
    }

    setIsInviting(true)
    setInviteStatus("Sending invite...")

    try {
      const response = await fetch("/api/members/invite", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ email, fullName, role, accessLevel }),
      })
      const body = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? "Invite failed")
      }

      setInviteStatus(body.message ?? "Member invited")
      setEmail("")
      setFullName("")
      setRole("member")
      setAccessLevel("member")
      await refreshData()
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "Invite failed")
    } finally {
      setIsInviting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</p>
        <h2 className="font-serif text-2xl font-semibold">Invite-only committee access</h2>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <h3 className="font-semibold">Invite member</h3>
          </div>
          <form onSubmit={submitInvite} className="grid gap-3 lg:grid-cols-[1fr_1fr_150px_150px_auto]">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Invite email</Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={!canManage || isInviting}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-name">Invite full name</Label>
              <Input
                id="invite-name"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={!canManage || isInviting}
                required
              />
            </div>
            <label className="grid gap-1.5 text-sm font-medium">
              Invite role
              <select
                aria-label="Invite role"
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={!canManage || isInviting}
                className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
              >
                <option value="member">Member</option>
                <option value="treasurer">Treasurer</option>
                <option value="secretary">Secretary</option>
                <option value="chair">Chair</option>
                <option value="admin">Admin</option>
                <option value="strata_manager">Strata manager</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Invite access level
              <select
                aria-label="Invite access level"
                value={accessLevel}
                onChange={(event) => setAccessLevel(event.target.value)}
                disabled={!canManage || isInviting}
                className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
              >
                <option value="member">Member</option>
                <option value="read_only">Read only</option>
                <option value="limited_admin">Limited admin</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <Button type="submit" disabled={!canManage || isInviting} className="self-end">
              <UserPlus data-icon="inline-start" />
              Invite
            </Button>
          </form>
          <Alert>
            <AlertDescription aria-live="polite">
              {canManage
                ? inviteStatus
                : "Sign in as an admin, chair, or secretary to invite members"}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="grid gap-3">
        {rawMembers.map((member) => (
          <MemberManagementRow
            key={`${member.id}-${member.roleValue}-${member.statusValue}-${member.accessValue}`}
            member={member}
            canManage={canManage}
            isCurrentMember={currentMember?.id === member.id}
            onDataRefresh={refreshData}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{people.length}</span>{" "}
            workspace members
          </p>
        </div>
        <InputGroup className="h-9 w-full sm:w-64">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      <Card className="py-0">
        <CardContent className="flex flex-col px-0">
          {filtered.map((p, i) => (
            <div key={p.id}>
              <div className="flex items-center gap-3 px-4 py-3">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-accent text-xs text-accent-foreground">
                    {p.initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.contextLabel}</p>
                </div>
                <Badge variant={roleVariant[p.role]}>{p.role}</Badge>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Email ${p.name}`}
                  nativeButton={false}
                  render={<a href={`mailto:${p.email}`} />}
                >
                  <Mail />
                </Button>
              </div>
              {i < filtered.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function MemberManagementRow({
  member,
  canManage,
  isCurrentMember,
  onDataRefresh,
}: {
  member: Member
  canManage: boolean
  isCurrentMember: boolean
  onDataRefresh: () => Promise<unknown>
}) {
  const [fullName, setFullName] = React.useState(member.name)
  const [role, setRole] = React.useState(member.roleValue)
  const [status, setStatus] = React.useState(member.statusValue)
  const [accessLevel, setAccessLevel] = React.useState(member.accessValue)
  const [result, setResult] = React.useState("Ready")
  const [isSaving, setIsSaving] = React.useState(false)
  const dirty =
    fullName !== member.name ||
    role !== member.roleValue ||
    status !== member.statusValue ||
    accessLevel !== member.accessValue

  async function saveMember() {
    if (!canManage) return

    setIsSaving(true)
    setResult("Saving member access...")

    try {
      const response = await fetch("/api/members/update", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({
          memberId: member.id,
          fullName,
          role,
          status,
          accessLevel,
        }),
      })
      const body = (await response.json()) as { message?: string; error?: string }

      if (!response.ok) {
        throw new Error(body.error ?? "Member update failed")
      }

      setResult(body.message ?? "Member updated")
      await onDataRefresh()
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Member update failed")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border bg-card p-4 lg:grid-cols-[1fr_150px_150px_150px_auto] lg:items-start">
      <div className="grid gap-1.5">
        <Label htmlFor={`member-name-${member.id}`}>Name for {member.email}</Label>
        <Input
          id={`member-name-${member.id}`}
          aria-label={`Name for ${member.email}`}
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
          disabled={!canManage || isSaving}
        />
        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
        <p className="text-xs text-muted-foreground">{member.lastActive}</p>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Role
        <select
          aria-label={`Role for ${member.email}`}
          value={role}
          onChange={(event) => setRole(event.target.value)}
          disabled={!canManage || isCurrentMember || isSaving}
          className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
        >
          <option value="member">Member</option>
          <option value="treasurer">Treasurer</option>
          <option value="secretary">Secretary</option>
          <option value="chair">Chair</option>
          <option value="admin">Admin</option>
          <option value="strata_manager">Strata manager</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Access level
        <select
          aria-label={`Access level for ${member.email}`}
          value={accessLevel}
          onChange={(event) => setAccessLevel(event.target.value)}
          disabled={!canManage || isCurrentMember || isSaving}
          className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
        >
          <option value="member">Member</option>
          <option value="read_only">Read only</option>
          <option value="limited_admin">Limited admin</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Status
        <select
          aria-label={`Status for ${member.email}`}
          value={status}
          onChange={(event) => setStatus(event.target.value as Member["statusValue"])}
          disabled={!canManage || isCurrentMember || isSaving}
          className="h-11 rounded-lg border border-input bg-background px-2 text-sm md:h-8"
        >
          <option value="active">Active</option>
          <option value="invited">Invited</option>
          <option value="suspended">Inactive</option>
        </select>
      </label>
      <div className="grid gap-2">
        <Button
          type="button"
          aria-label={`Save member ${member.email}`}
          onClick={saveMember}
          disabled={!canManage || !dirty || isSaving}
        >
          <Check data-icon="inline-start" />
          Save
        </Button>
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status === "active" ? "Active" : status === "invited" ? "Invited" : "Inactive"}
        </Badge>
        <p className="max-w-44 text-xs text-muted-foreground" aria-live="polite">{result}</p>
      </div>
    </div>
  )
}
