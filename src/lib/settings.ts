import { prisma } from "./db";

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
}

export async function reviewModeOn(): Promise<boolean> {
  return (await getSetting("reviewMode", "true")) === "true";
}

export async function followUpDays(): Promise<number> {
  return parseInt(await getSetting("followUpDays", "20"), 10) || 20;
}
