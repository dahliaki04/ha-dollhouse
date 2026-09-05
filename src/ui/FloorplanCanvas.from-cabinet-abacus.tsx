import { useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Floorplan, FloorplanZone } from '../domain/types'

const MIN_SIZE = 0.03

type Corner = 'nw' | 'ne' | 'sw' | 'se'

interface DraftRect { x0: number; y0: number; x1: number; y1: number }

interface EditState {
  zoneId: string
  kind: 'move' | Corner
  /** pointer 起點（normalized） */
  px: number
  py: number
  orig: FloorplanZone
}

interface Props {
  floorplan: Floorplan
  drawMode: boolean
  editMode: boolean
  /** 拉完一個框（normalized rect），由呼叫端命名並加入 */
  onDraw: (rect: { x: number; y: number; w: number; h: number }) => void
  onZoneChange: (zone: FloorplanZone) => void
  onZoneRemove: (zoneId: string) => void
  onZoneRename: (zone: FloorplanZone) => void
  /** 框內的附加內容（chips 等，頁面各自定義） */
  renderZoneExtras?: (zone: FloorplanZone) => ReactNode
  /** callout 編號（圖上只顯示編號，內容在圖外清單） */
  zoneNumber?: (zone: FloorplanZone) => number | undefined
  /** 目前選中的空間（泡泡＋框強調，與清單雙向對應） */
  activeRoom?: string | null
  /** 一般模式點泡泡（編輯模式點泡泡＝改名） */
  onZoneTap?: (zone: FloorplanZone) => void
  /** 框的外層元素（AssignPage 用 droppable 包），預設純 div */
  zoneElement?: (zone: FloorplanZone, className: string, style: CSSProperties, children: ReactNode) => ReactNode
  style?: CSSProperties
}

const posStyle = (z: { x: number; y: number; w: number; h: number }): CSSProperties => ({
  left: `${z.x * 100}%`,
  top: `${z.y * 100}%`,
  width: `${z.w * 100}%`,
  height: `${z.h * 100}%`,
})

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 平面圖畫布：底圖 + 空間框（可拉框新增；編輯模式可移動/四角縮放/改名） */
export function FloorplanCanvas({
  floorplan, drawMode, editMode, onDraw, onZoneChange, onZoneRemove, onZoneRename,
  renderZoneExtras, zoneNumber, activeRoom, onZoneTap, zoneElement, style,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState<DraftRect | null>(null)
  const [edit, setEdit] = useState<EditState | null>(null)

  const norm = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = wrapRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return
    const p = norm(e)
    if (p) setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y })
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const p = norm(e)
    if (!p) return
    if (drawMode && draft) {
      setDraft({ ...draft, x1: p.x, y1: p.y })
      return
    }
    if (edit) {
      const { orig, kind } = edit
      if (kind === 'move') {
        onZoneChange({
          ...orig,
          x: clamp(orig.x + (p.x - edit.px), 0, 1 - orig.w),
          y: clamp(orig.y + (p.y - edit.py), 0, 1 - orig.h),
        })
        return
      }
      const right = orig.x + orig.w
      const bottom = orig.y + orig.h
      let { x, y, w, h } = orig
      if (kind === 'se' || kind === 'ne') w = clamp(p.x - orig.x, MIN_SIZE, 1 - orig.x)
      if (kind === 'se' || kind === 'sw') h = clamp(p.y - orig.y, MIN_SIZE, 1 - orig.y)
      if (kind === 'nw' || kind === 'sw') {
        x = clamp(p.x, 0, right - MIN_SIZE)
        w = right - x
      }
      if (kind === 'nw' || kind === 'ne') {
        y = clamp(p.y, 0, bottom - MIN_SIZE)
        h = bottom - y
      }
      onZoneChange({ ...orig, x, y, w, h })
    }
  }

  const onPointerUp = () => {
    if (draft) {
      const rect = {
        x: Math.min(draft.x0, draft.x1),
        y: Math.min(draft.y0, draft.y1),
        w: Math.abs(draft.x1 - draft.x0),
        h: Math.abs(draft.y1 - draft.y0),
      }
      setDraft(null)
      if (rect.w >= MIN_SIZE && rect.h >= MIN_SIZE) onDraw(rect)
      return
    }
    setEdit(null)
  }

  const startEdit = (e: React.PointerEvent, zone: FloorplanZone, kind: EditState['kind']) => {
    e.stopPropagation()
    const p = norm(e)
    if (!p) return
    setEdit({ zoneId: zone.id, kind, px: p.x, py: p.y, orig: zone })
  }

  if (!floorplan.image) return null

  const renderEl =
    zoneElement ??
    ((zone: FloorplanZone, className: string, s: CSSProperties, children: ReactNode) => (
      <div className={className} style={s} key={zone.id}>{children}</div>
    ))

  return (
    <div
      className="fp-wrap"
      ref={wrapRef}
      style={{
        touchAction: drawMode || editMode ? 'none' : undefined,
        cursor: drawMode ? 'crosshair' : undefined,
        ...style,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <img src={floorplan.image} alt="平面圖" draggable={false} />

      {floorplan.zones.map((zone) => {
        const n = zoneNumber?.(zone)
        const isActive = activeRoom != null && activeRoom === zone.room
        const unnamed = !zone.room
        return renderEl(
          zone,
          `fp-zone${isActive ? ' active' : ''}${unnamed ? ' unnamed' : ''}`,
          posStyle(zone),
          <>
            {n !== undefined || unnamed ? (
              <span
                className={`fp-bubble${isActive ? ' active' : ''}${unnamed ? ' unnamed' : ''}`}
                title={unnamed ? '未命名——點擊命名' : editMode ? `${zone.room}（點擊改名）` : zone.room}
                onClick={(e) => {
                  e.stopPropagation()
                  if (unnamed || editMode) onZoneRename(zone)
                  else onZoneTap?.(zone)
                }}
              >
                {unnamed ? '？' : n}
              </span>
            ) : (
              <span
                className="fp-zone-label mono"
                style={editMode ? { cursor: 'pointer' } : undefined}
                onClick={editMode ? () => onZoneRename(zone) : undefined}
                title={editMode ? `${zone.room}（點擊改名）` : zone.room}
              >
                {zone.room}
              </span>
            )}
            {editMode && (
              <button
                className="fp-zone-del-edit no-print"
                onClick={(e) => { e.stopPropagation(); onZoneRemove(zone.id) }}
                title="刪除框"
              >
                ✕
              </button>
            )}
            {renderZoneExtras?.(zone)}
          </>,
        )
      })}

      {editMode &&
        floorplan.zones.map((zone) => (
          <div className="fp-edit" style={posStyle(zone)} key={`edit-${zone.id}`}>
            <div className="fp-move" onPointerDown={(e) => startEdit(e, zone, 'move')} />
            {(['nw', 'ne', 'sw', 'se'] as Corner[]).map((corner) => (
              <div
                key={corner}
                className={`fp-handle fp-handle-${corner}`}
                onPointerDown={(e) => startEdit(e, zone, corner)}
              />
            ))}
          </div>
        ))}

      {draft && (
        <div
          className="fp-draft"
          style={posStyle({
            x: Math.min(draft.x0, draft.x1),
            y: Math.min(draft.y0, draft.y1),
            w: Math.abs(draft.x1 - draft.x0),
            h: Math.abs(draft.y1 - draft.y0),
          })}
        />
      )}
    </div>
  )
}
