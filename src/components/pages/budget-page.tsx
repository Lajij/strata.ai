"use client"

import { Building2, CircleDollarSign, FileText, ShieldCheck } from "lucide-react"

import { useAppStore } from "@/components/app-store"
import { BudgetAiTool } from "@/components/assistant/ai-tools"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const currency = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
})

export function BudgetPage() {
  const { rawBudgetLines, rawBudgetRecommendation, rawVendors } = useAppStore()

  return (
    <div className="flex flex-col gap-6">
      <BudgetAiTool />

      {rawBudgetRecommendation.summary ? (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
              <CardTitle>Budget recommendation</CardTitle>
            </div>
            <CardDescription>Pre-computed guidance from visible workspace records.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm leading-6">{rawBudgetRecommendation.summary}</p>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Citations
              </p>
              {rawBudgetRecommendation.citations.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {rawBudgetRecommendation.citations.map((citation) => (
                    <li key={citation}>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {citation}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No citations supplied.</p>
              )}
            </div>
            <p className="border-t border-border pt-4 text-xs italic text-muted-foreground">
              {rawBudgetRecommendation.disclaimer || "No disclaimer supplied."}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <section aria-labelledby="budget-lines-heading">
        <div className="mb-3 flex items-center gap-2">
          <CircleDollarSign className="size-4 text-primary" aria-hidden="true" />
          <h2 id="budget-lines-heading" className="text-sm font-semibold">
            Budget lines
          </h2>
        </div>
        {rawBudgetLines.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {rawBudgetLines.map((line) => (
              <Card key={`${line.category}-${line.account}`} size="sm">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle>{line.category}</CardTitle>
                      <CardDescription>{line.account}</CardDescription>
                    </div>
                    <Badge variant="outline">{line.risk}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-3 gap-3">
                    {[
                      ["Approved", line.approved],
                      ["Committed", line.committed],
                      ["Actual", line.actual],
                    ].map(([label, value]) => (
                      <div key={String(label)} className="min-w-0">
                        <dt className="text-xs text-muted-foreground">{label}</dt>
                        <dd className="mt-1 truncate text-sm font-semibold tabular-nums" title={currency.format(Number(value))}>
                          {currency.format(Number(value))}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No budget lines are visible to this session.
            </CardContent>
          </Card>
        )}
      </section>

      <Separator />

      <section aria-labelledby="vendors-heading">
        <div className="mb-3 flex items-center gap-2">
          <Building2 className="size-4 text-primary" aria-hidden="true" />
          <h2 id="vendors-heading" className="text-sm font-semibold">
            Vendors
          </h2>
        </div>
        {rawVendors.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {rawVendors.map((vendor) => (
              <Card key={vendor.id} size="sm">
                <CardHeader>
                  <CardTitle>{vendor.name}</CardTitle>
                  <CardDescription className="font-mono text-[10px]">
                    vendor:{vendor.id}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <p className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span>{vendor.insuranceStatus || "Insurance status not recorded"}</span>
                  </p>
                  <p className="break-all text-muted-foreground">
                    {vendor.contactEmail || "Email not recorded"}
                  </p>
                  <p className="text-muted-foreground">{vendor.phone || "Phone not recorded"}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No vendor records are visible to this session.
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  )
}
