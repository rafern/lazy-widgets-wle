import type { Component, RayHit, Object as $Object } from '@wonderlandengine/api';

export class Cursor extends Component {
    rayHit: RayHit;
}

export type CursorCallback = (object: $Object, cursor: Cursor) => void;

export class CursorTarget extends Component {
    addUnHoverFunction(callback: CursorCallback);
    addMoveFunction(callback: CursorCallback);
    addDownFunction(callback: CursorCallback);
    addUpFunction(callback: CursorCallback);

    removeUnHoverFunction(callback: CursorCallback);
    removeMoveFunction(callback: CursorCallback);
    removeDownFunction(callback: CursorCallback);
    removeUpFunction(callback: CursorCallback);
}
