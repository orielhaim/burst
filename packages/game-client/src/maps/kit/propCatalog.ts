import type { PropComponent, PropId } from "../types";
import {
	Book,
	BookStack,
	CoverBlock,
	DeskLeg,
	DeskSlab,
	Eraser,
	Laptop,
	Monitor,
	Mug,
	NotebookClosed,
	NotebookOpen,
	Paperclip,
	PaperSlip,
	PaperStack,
	Pen,
	Pencil,
	Phone,
	RoomFloor,
	Ruler,
	SpawnPad,
	Sticky,
	TapeRoll,
} from "./props";

/**
 * Reusable prop catalog. New maps declare PropId + transform only —
 * mesh + collider stay owned by the kit component.
 */
export const PROP_CATALOG: Record<PropId, PropComponent> = {
	"desk-slab": DeskSlab,
	"desk-leg": DeskLeg,
	"notebook-open": NotebookOpen,
	"notebook-closed": NotebookClosed,
	book: Book,
	"book-stack": BookStack,
	pen: Pen,
	pencil: Pencil,
	eraser: Eraser,
	ruler: Ruler,
	sticky: Sticky,
	"paper-stack": PaperStack,
	"paper-slip": PaperSlip,
	laptop: Laptop,
	monitor: Monitor,
	mug: Mug,
	paperclip: Paperclip,
	"tape-roll": TapeRoll,
	phone: Phone,
	"cover-block": CoverBlock,
	"room-floor": RoomFloor,
	"spawn-pad": SpawnPad,
};

export function resolveProp(id: PropId): PropComponent | undefined {
	return PROP_CATALOG[id];
}
