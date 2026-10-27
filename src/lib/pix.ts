// BR Code estático. O payload é regenerado a partir do total confirmado no servidor.
export const LABOR_PIX_KEY = "21572534000162";

export function validCnpj(value: string): boolean {
  if (!/^\d{14}$/.test(value) || /^(\d)\1{13}$/.test(value)) return false;
  const digit = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((acc, weight, i) => acc + Number(value[i]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return digit(12) === Number(value[12]) && digit(13) === Number(value[13]);
}

function tlv(id: string, value: string): string {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error("Campo Pix excede o limite BR Code.");
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

function crc16(text: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++)
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function pixCode(order: { id: string; total: number }, key = LABOR_PIX_KEY): string {
  if (!validCnpj(key)) throw new Error("Chave Pix CNPJ inválida.");
  const cents = Math.round(order.total * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || Math.abs(order.total * 100 - cents) > 0.00001)
    throw new Error("Valor Pix inválido.");
  const txid = order.id.replace(/-/g, "").slice(0, 25).toUpperCase();
  if (!/^[A-F0-9]{25}$/.test(txid)) throw new Error("Identificador do pedido inválido.");
  const body =
    tlv("00", "01") +
    tlv("26", tlv("00", "BR.GOV.BCB.PIX") + tlv("01", key)) +
    tlv("52", "0000") +
    tlv("53", "986") +
    tlv("54", (cents / 100).toFixed(2)) +
    tlv("58", "BR") +
    tlv("59", "ACAI LABOR") +
    tlv("60", "SAO PAULO") +
    tlv("62", tlv("05", txid)) +
    "6304";
  return body + crc16(body);
}
