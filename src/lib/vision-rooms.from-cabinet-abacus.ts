// Reference copy from cabinet-abacus app/src/lib/vision.ts (room detection only). Not wired yet.

export const ROOMS_PROMPT = `Analyze this floor plan image. Identify every room/space (e.g. 客廳, 餐廳, 主臥, 次臥, 廚房, 浴室, 玄關, 走道, 陽台).

1. Use ONLY the room labels printed on the plan (Traditional Chinese). If a room has no readable
   text label, still include it but set n to "" — do NOT guess a name from fixtures.
   （沒有文字的空間一樣要框，名稱留空，由使用者命名。）
2. Draw each room's boundary polygon as [[x%,y%],...] (% of image, 0-100).

List ALL rooms. Return raw JSON only:
{"rooms":[{"n":"客廳","p":[[10,20],[45,20],[45,60],[10,60]]}]}`


export interface DetectedRoom {
  room: string
  x: number
  y: number
  w: number
  h: number
}


export function parseRoomsResponse(text: string): DetectedRoom[] {
  const parsed = extractJson<{ rooms?: { n?: string; p?: number[][] }[] }>(text)
  const allCoords = (parsed.rooms ?? []).flatMap((r) => (Array.isArray(r.p) ? r.p.flat() : []))
    .filter((v): v is number => typeof v === 'number' && isFinite(v))
  const maxCoord = Math.max(0, ...allCoords)
  const divisor = maxCoord <= 100 ? 100 : maxCoord <= 1000 ? 1000 : maxCoord * 1.02
  const out: DetectedRoom[] = []
  for (const r of parsed.rooms ?? []) {
    if (!Array.isArray(r.p) || r.p.length < 3) continue
    const xs = r.p.map((p) => p[0] / divisor)
    const ys = r.p.map((p) => p[1] / divisor)
    const x = Math.max(0, Math.min(...xs))
    const y = Math.max(0, Math.min(...ys))
    out.push({
      room: r.n?.trim() || '', // 空字串 = 未命名，畫布上以「？」高亮提示使用者填
      x, y,
      w: Math.min(1, Math.max(...xs)) - x,
      h: Math.min(1, Math.max(...ys)) - y,
    })
  }
  return out.filter((z) => z.w > 0.02 && z.h > 0.02)
}


/** 回應文字 → JSON（含截斷救援） */
export function extractJson<T>(text: string): T {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()
  const start = cleaned.indexOf('{')
  if (start === -1) throw new Error('回應中沒有 JSON')
  let jsonText = cleaned.slice(start)
  try {
    return JSON.parse(jsonText) as T
  } catch {
    const last = jsonText.lastIndexOf('},')
    if (last <= 0) throw new Error('解析失敗')
    jsonText = jsonText.slice(0, last + 1) + ']}'
    return JSON.parse(jsonText) as T
  }
}


/** AI 房間偵測（CoolSense 流程移植）：polygon → 外接矩形 zone */
export async function detectRooms(imageDataUrl: string): Promise<DetectedRoom[]> {
  return withFailureTracking('rooms', async () => {
    const base64 = await toJpegBase64(imageDataUrl, 1200)
    const rooms = parseRoomsResponse(await callGemini(base64, ROOMS_PROMPT, 16384))
    track('ai_rooms', { n: rooms.length })
    return rooms
  })
}
