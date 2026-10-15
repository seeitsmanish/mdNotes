"use client";

import { useRef, useState } from "react";
import { useUiStore } from "@/lib/store/useUiStore";
import type { Group } from "@/lib/workbench/group";
import { groupIds, measure, type Rect, type Sash, type Side } from "@/lib/workbench/layout";
import * as W from "@/lib/workbench/workbench";
import { currentDrag, endDrag, wantsCopy } from "./drag";
import { GroupTabs, type TabInfo } from "./GroupTabs";

const run = (action: (wb: W.Workbench) => W.Workbench) => useUiStore.getState().workbench(action);

const pct = (value: number) => `${value * 100}%`;

/**
 * The editor grid (PRD §4.81). Every group is placed absolutely from the
 * layout's measurements and keyed by its id, so changing the layout —
 * splitting, closing, maximising, dragging a divider — moves editors without
 * rebuilding them: caret, scroll and undo survive.
 */
export function Workbench({
  renderGroup,
  info,
}: {
  /** The group's note pane: the note shown, or an empty-group message. */
  renderGroup: (group: Group, isActive: boolean, corner: boolean) => React.ReactNode;
  info: TabInfo;
}) {
  const wb = useUiStore((s) => s.wb);
  const host = useRef<HTMLDivElement>(null);
  const { rects, sashes } = measure(wb.layout);
  const ids = groupIds(wb.layout);

  return (
    <div ref={host} className="ursa-workbench relative h-full min-h-0 w-full min-w-0 overflow-hidden">
      {ids.map((id) => {
        const group = wb.groups[id]!;
        const hidden = wb.maximized !== null && wb.maximized !== id;
        const rect: Rect = wb.maximized === id ? { x: 0, y: 0, w: 1, h: 1 } : rects.get(id)!;
        return (
          <GroupFrame
            key={id}
            group={group}
            rect={rect}
            hidden={hidden}
            isActive={wb.active === id}
            groupCount={ids.length}
            maximized={wb.maximized === id}
            info={info}
          >
            {/* The top-right group carries the app-wide buttons. */}
            {renderGroup(group, wb.active === id, rect.y < 1e-6 && rect.x + rect.w > 1 - 1e-6)}
          </GroupFrame>
        );
      })}
      {wb.maximized === null &&
        sashes.map((sash) => <SashHandle key={`${sash.path.join(".")}:${sash.index}`} sash={sash} host={host} />)}
    </div>
  );
}

function GroupFrame({
  group,
  rect,
  hidden,
  isActive,
  groupCount,
  maximized,
  info,
  children,
}: {
  group: Group;
  rect: Rect;
  hidden: boolean;
  isActive: boolean;
  groupCount: number;
  maximized: boolean;
  info: TabInfo;
  children: React.ReactNode;
}) {
  const [zone, setZone] = useState<Side | "center" | null>(null);

  const zoneAt = (event: React.DragEvent): Side | "center" => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width;
    const y = (event.clientY - box.top) / box.height;
    // The edge nearest the pointer, if within a third of the way in.
    const edges: Array<[Side, number]> = [
      ["left", x],
      ["right", 1 - x],
      ["up", y],
      ["down", 1 - y],
    ];
    const [side, distance] = edges.sort((a, b) => a[1] - b[1])[0]!;
    return distance < 0.3 ? side : "center";
  };

  const focus = () => {
    if (useUiStore.getState().wb.active !== group.id) run((wb) => W.focusGroup(wb, group.id));
  };

  return (
    <section
      aria-label="Editor group"
      data-ursa-group={group.id}
      data-active={isActive ? "" : undefined}
      hidden={hidden}
      onPointerDownCapture={focus}
      onFocusCapture={focus}
      style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h) }}
      className={`ursa-group absolute flex min-h-0 min-w-0 flex-col bg-canvas ${rect.x > 0 ? "border-l border-border" : ""} ${
        rect.y > 0 ? "border-t border-border" : ""
      }`}
    >
      <GroupTabs group={group} isActive={isActive} groupCount={groupCount} maximized={maximized} info={info} />
      <div
        className="relative min-h-0 flex-1"
        onDragOver={(event) => {
          // Shift held: let it fall into the text as a link instead.
          if (!currentDrag(event) || event.shiftKey) {
            setZone(null);
            return;
          }
          event.preventDefault();
          event.dataTransfer.dropEffect = wantsCopy(event) ? "copy" : "move";
          setZone(zoneAt(event));
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setZone(null);
        }}
        onDrop={(event) => {
          const drag = currentDrag(event);
          setZone(null);
          if (!drag || event.shiftKey) return;
          event.preventDefault();
          endDrag();
          const where = zoneAt(event);
          run((wb) => W.dropTab(wb, drag.group, drag.note, group.id, where === "center" ? null : where, wantsCopy(event)));
        }}
      >
        {children}
        {zone && <div aria-hidden data-ursa-drop-zone={zone} className="ursa-drop-zone" />}
      </div>
    </section>
  );
}

/** A divider between groups: drag it, or double-click to even out the sizes. */
function SashHandle({ sash, host }: { sash: Sash; host: React.RefObject<HTMLDivElement | null> }) {
  const across = sash.axis === "row";
  const style: React.CSSProperties = across
    ? { left: pct(sash.at), top: pct(sash.from), height: pct(sash.span) }
    : { top: pct(sash.at), left: pct(sash.from), width: pct(sash.span) };
  return (
    <div
      role="separator"
      aria-orientation={across ? "vertical" : "horizontal"}
      aria-label="Resize editor groups"
      tabIndex={0}
      data-ursa-sash=""
      style={style}
      className={`ursa-sash absolute z-10 ${across ? "ursa-sash-v" : "ursa-sash-h"}`}
      onPointerDown={(event) => {
        const box = host.current?.getBoundingClientRect();
        if (!box) return;
        event.preventDefault();
        const target = event.currentTarget;
        target.setPointerCapture(event.pointerId);
        target.dataset.dragging = "";
        const move = (e: PointerEvent) => {
          const at = across ? (e.clientX - box.left) / box.width : (e.clientY - box.top) / box.height;
          run((wb) => W.resize(wb, sash.path, sash.index, at));
        };
        const up = () => {
          delete target.dataset.dragging;
          target.removeEventListener("pointermove", move);
          target.removeEventListener("pointerup", up);
          target.removeEventListener("pointercancel", up);
        };
        target.addEventListener("pointermove", move);
        target.addEventListener("pointerup", up);
        target.addEventListener("pointercancel", up);
      }}
      onDoubleClick={() => run(W.even)}
      onKeyDown={(event) => {
        const back = across ? "ArrowLeft" : "ArrowUp";
        const forward = across ? "ArrowRight" : "ArrowDown";
        if (event.key !== back && event.key !== forward) return;
        event.preventDefault();
        run((wb) => W.resize(wb, sash.path, sash.index, sash.at + (event.key === forward ? 0.03 : -0.03)));
      }}
    />
  );
}
