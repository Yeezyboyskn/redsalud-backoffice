"use client"
import { Button } from "@/components/ui/button"

export default function LogoutButton(){
  return (
    <Button
      aria-label="Cerrar sesion"
      variant="ghost"
      size="sm"
      className="bg-white/10 text-primary-foreground hover:bg-white/20 hover:text-primary-foreground"
      onClick={()=>{
        document.cookie = "role=; Max-Age=0; path=/"
        document.cookie = "rut=; Max-Age=0; path=/"
        window.location.href = "/login"
      }}
    >
      Cerrar sesion
    </Button>
  )
}




