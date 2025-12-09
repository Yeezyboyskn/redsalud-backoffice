"use client"
import AppShell from "@/components/common/AppShell"
import { useEffect, useState } from "react"
import DoctorProfileCard from "@/components/doctor-v2/DoctorProfileCard"
import ExtraHoursPanel from "@/components/doctor-v2/ExtraHoursPanel"
import BlockRequestsPanel from "@/components/doctor-v2/BlockRequestsPanel"
import PendingRequests from "@/components/doctor-v2/PendingRequests"
import SpecialRequestsPanel from "@/components/doctor-v2/SpecialRequestsPanel"

function getCookie(name: string) {
  if (typeof document === "undefined") return ""
  const m = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return m ? decodeURIComponent(m[2]) : ""
}

export default function DoctorV2Page() {
  const [rut, setRut] = useState<string | undefined>(undefined)
  useEffect(() => {
    setRut(getCookie("rut") || "")
  }, [])

  if (rut === undefined) return null

  if (!rut) {
    return (
      <AppShell>
        <section className="rounded-2xl border border-border/60 bg-white/90 p-6 shadow-lg">
          <p className="font-medium text-destructive">No pudimos identificar tu sesión. Inicia nuevamente con tu RUT corporativo.</p>
        </section>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <DoctorProfileCard />
        <PendingRequests />
        <ExtraHoursPanel />
        <BlockRequestsPanel />
        <SpecialRequestsPanel />
      </div>
    </AppShell>
  )
}
