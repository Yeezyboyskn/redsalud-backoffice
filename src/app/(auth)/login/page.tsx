"use client"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { validateRut, formatRut, cleanRut } from "@/lib/rut"
import { setCookie } from "@/lib/cookies"
import { detectRoleByRut, getUserByRut, roleHomePath } from "@/lib/mock-roles"

const schema = z.object({
  rut: z.string().min(7, "RUT requerido").refine(validateRut, "RUT invalido"),
  password: z.string().min(4, "Minimo 4 caracteres"),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rut: "", password: "" },
  })

  const router = useRouter()

  const rut = watch("rut") ?? ""
  // formato de RUT en caliente; la deteccion de rol ocurre al enviar

  const onSubmit = async (data: FormData) => {
    const rutClean = cleanRut(data.rut)
    // 1) Intentar como doctor en BD
    try {
      const res = await fetch(`/api/doctor/profile?rut=${encodeURIComponent(rutClean)}`)
      if (res.ok) {
        const generic = process.env.NEXT_PUBLIC_DOCTOR_PASSWORD || "doctor123"
        if (data.password !== generic) {
          toast.error("Contrasena incorrecta para perfil doctor")
          return
        }
        setCookie("role", "doctor")
        setCookie("rut", rutClean)
        toast.success("Sesion iniciada como doctor")
        router.push(roleHomePath("doctor"))
        return
      }
    } catch {}
    // 2) Fallback a perfiles mock (agendamiento/jefatura/admin)
    const role = detectRoleByRut(data.rut)
    const user = getUserByRut(data.rut)
    if (!role || !user) {
      toast.error("RUT no reconocido")
      return
    }
    if (user.password && data.password !== user.password) {
      toast.error("Contrasena incorrecta")
      return
    }
    setCookie("role", role)
    setCookie("rut", rutClean)
    toast.success(`Sesion iniciada como ${role}`)
    router.push(roleHomePath(role))
  }

  return (
    <div className="grid min-h-dvh bg-gradient-to-br from-[#f1faf9] via-[#f7fcfc] to-[#e1f4f4] lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-primary via-[#00b7ae] to-[#009389]" />
        <div className="absolute -left-36 top-12 h-72 w-72 rounded-full bg-white/20 blur-2xl" />
        <div className="absolute -right-32 bottom-10 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
        <div className="relative z-10 max-w-md space-y-8 px-12 text-primary-foreground">
          <div className="flex items-center gap-4">
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/30 bg-white/10 text-2xl font-semibold">RS</span>
            <div className="space-y-1">
              <p className="text-sm uppercase tracking-[0.4em] text-primary-foreground/70">RedSalud</p>
              <p className="text-3xl font-semibold leading-tight">Personas al centro</p>
            </div>
          </div>
          <p className="text-lg leading-relaxed text-primary-foreground/80">
            Conectate con la red clinica mas grande de Chile y gestiona tus operaciones con el sello humano de RedSalud.
          </p>
          <ul className="space-y-3 text-sm text-primary-foreground/75">
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">1</span>
              <span>Visibilidad integral de boxes, agendas y KPIs en tiempo real.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">2</span>
              <span>Experiencia coherente con la identidad RedSalud para cada equipo.</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[11px] font-semibold">3</span>
              <span>Autenticacion rapida y segura segun tu perfil de usuario.</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-12">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-2xl text-secondary">Ingreso a RedSalud</CardTitle>
            <CardDescription>Usa tu RUT y credenciales de RedSalud para comenzar a gestionar.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="rut">RUT / Usuario</Label>
                <Input id="rut" autoComplete="username" {...register("rut")} value={rut} onChange={(e) => setValue("rut", formatRut(e.target.value), { shouldValidate: true })} placeholder="11.111.111-1" />
                {errors.rut && <p className="text-xs text-destructive">{errors.rut.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contrasena</Label>
                <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
                {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
              </div>
              {/* Rol se detecta automaticamente por RUT; no se muestra selector */}
              <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? "Ingresando..." : "Ingresar"}</Button>
            </form>
            <p className="text-xs text-muted-foreground">Si tienes problemas para ingresar, contactanos en soporte@RedSalud.cl</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

