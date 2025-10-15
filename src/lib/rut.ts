export function cleanRut(rut: string) {
  return rut.replace(/[^0-9kK]/g, "").toUpperCase()
}

export function formatRut(rut: string) {
  const cleaned = cleanRut(rut)
  if (!cleaned) return ""
  const body = cleaned.slice(0, -1)
  const dv = cleaned.slice(-1)
  let out = ""
  const reversed = body.split("").reverse().join("")
  for (let index = 0; index < reversed.length; index += 1) {
    out += reversed[index]
    const shouldInsertDot = (index + 1) % 3 === 0 && index + 1 !== reversed.length
    if (shouldInsertDot) out += "."
  }
  return out.split("").reverse().join("") + "-" + dv
}

export function validateRut(rut: string) {
  const cleaned = cleanRut(rut)
  if (cleaned.length < 2) return false
  const body = cleaned.slice(0, -1)
  const dv = cleaned.slice(-1)
  let sum = 0
  let multiplier = 2
  for (let index = body.length - 1; index >= 0; index -= 1) {
    sum += parseInt(body[index], 10) * multiplier
    multiplier = multiplier === 7 ? 2 : multiplier + 1
  }
  const mod = 11 - (sum % 11)
  const expected = mod === 11 ? "0" : mod === 10 ? "K" : String(mod)
  return dv.toUpperCase() === expected
}
