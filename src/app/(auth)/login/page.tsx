"use client"
import { useForm } from "react-hook-form"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { validateRut, formatRut, cleanRut } from "@/lib/rut"
import { setCookie } from "@/lib/cookies"

const schema = z.object({
  rut: z.string().min(7, "RUT requerido").refine(validateRut, "RUT inválido"),
  password: z.string().min(4, "Mínimo 4 caracteres"),
  role: z.enum(["doctor", "agendamiento", "jefatura", "admin"]),
})
type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { rut: "", password: "", role: "doctor" }, // controlado desde inicio
  })

  const router = useRouter()
  const onSubmit = (data: FormData) => {
    setCookie("role", data.role)
    setCookie("rut", cleanRut(data.rut))
    toast.success(`Sesión como ${data.role}`)
    const map = { doctor: "/doctor", agendamiento: "/agendamiento", jefatura: "/jefatura", admin: "/admin" } as const
    router.push(map[data.role])
  }

  const rut = watch("rut") ?? ""

  return (
    <div className="grid place-items-center min-h-dvh p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Inicio de sesión</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="rut">RUT / Usuario</Label>
            <Input
              id="rut"
              autoComplete="username"
              {...register("rut")}
              value={rut}
              onChange={(e) => setValue("rut", formatRut(e.target.value), { shouldValidate: true })}
              placeholder="11.111.111-1"
            />
            {errors.rut && <p className="text-sm text-red-600">{errors.rut.message}</p>}
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register("password")} />
            {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
          </div>
          <div>
            <Label htmlFor="role">Rol</Label>
            <select id="role" className="w-full border rounded-md h-10 px-3" {...register("role")}>
              <option value="doctor">Doctor</option>
              <option value="agendamiento">Equipo de Agendamiento</option>
              <option value="jefatura">Jefatura</option>
              <option value="admin">Admin</option>
            </select>
            {errors.role && <p className="text-sm text-red-600">{errors.role.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            Entrar
          </Button>
        </form>
      </Card>
    </div>
  )
}
