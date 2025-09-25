export function cleanRut(rut: string) {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase()
}
export function formatRut(rut: string) {
  const c = cleanRut(rut); if (!c) return ""
  const body = c.slice(0, -1), dv = c.slice(-1)
  let out = "", rev = body.split("").reverse().join("")
  for (let i = 0; i < rev.length; i++) out += rev[i] + ((i + 1) % 3 === 0 && i + 1 !== rev.length ? "." : "")
  return out.split("").reverse().join("") + "-" + dv
}
export function validateRut(rut: string) {
  const c = cleanRut(rut); if (c.length < 2) return false
  const body = c.slice(0, -1), dv = c.slice(-1)
  let sum = 0, mul = 2
  for (let i = body.length - 1; i >= 0; i--) { sum += parseInt(body[i]) * mul; mul = mul === 7 ? 2 : mul + 1 }
  const mod = 11 - (sum % 11)
  const exp = mod === 11 ? "0" : mod === 10 ? "K" : String(mod)
  return dv.toUpperCase() === exp
}
