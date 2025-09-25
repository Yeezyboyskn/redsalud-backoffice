"use client"
import { Button } from "@/components/ui/button"

export default function LogoutButton(){
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={()=>{
        document.cookie = "role=; Max-Age=0; path=/"
        document.cookie = "rut=; Max-Age=0; path=/"
        window.location.href = "/login"
      }}
    >
      Cerrar sesión
    </Button>
  )
}
