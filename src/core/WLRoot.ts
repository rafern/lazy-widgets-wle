import { Root, PointerDriver, DOMKeyboardDriver } from 'lazy-widgets';
import type { Widget, RootProperties } from 'lazy-widgets';
import { vec3, quat } from 'gl-matrix';
import { addPasteEventListener, removePasteEventListener } from './paste-event-listener';

// TODO use proper WLE types when official typescript support is released
/* eslint-disable @typescript-eslint/no-explicit-any */
declare const WL: any;

// Drivers shared by all UI roots. For some reason, setting up the drivers here
// crashes Wonderland Editor. Instead, use WLRoot.pointerDriver/keyboardDriver
let canvasUIPointerDriver: PointerDriver | null = null;
let canvasUIKeyboardDriver: DOMKeyboardDriver | null = null;

// Mapping for 'cursor' components to lazy-widgets pointer IDs. Use
// WLRoot.pointerIDs or WLRoot.getPointerID(cursor)
let canvasUIPointerIDs: Map<object, number> | null = null;

/** Impostor interface for the `cursor` WLE component. */
interface CursorComponent {
    rayHit: any /*WL.RayHit*/,
}

/** Impostor interface for the `cursor-target` WLE component. */
interface CursorTargetComponent {
    addUnHoverFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    addMoveFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    addDownFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    addUpFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    removeUnHoverFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    removeMoveFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    removeDownFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    removeUpFunction(callback: (object: any /*WL.Object*/, cursor: CursorComponent) => void): void,
    destroy(): void,
    active: boolean,
}

/** Impostor interface for WL.Materials with a flatTexture property. */
interface FlatMaterial /*extends WL.Material*/ {
    flatTexture: any /*WL.Texture*/,
}

/** Impostor interface for WL.Materials with a diffuseTexture property. */
interface DiffuseMaterial /*extends WL.Material*/ {
    diffuseTexture: any /*WL.Texture*/,
}

/**
 * Optional WLRoot constructor properties.
 *
 * @category Core
 */
export interface WLRootProperties extends RootProperties {
    /**
     * The amount of world units per canvas pixel. Determines the pixel density
     * of the mesh. 0.01 by default.
     */
    unitsPerPixel?: number,
    /**
     * The collision group that this root's collider will belong to. If null,
     * collider and cursor-target will not be added. 1 by default.
     */
    collisionGroup?: number,
    /**
     * Register the default pointer driver to this root? If collisionGroup is
     * null, this is forced to false. true by default.
     */
    registerPointerDriver?: boolean,
    /** Register the default keyboard driver to this root? true by default. */
    registerKeyboardDriver?: boolean,
    /**
     * Should the material used for the Root be cloned? If false, then the
     * actual material will be used, which will lead to issues if the material
     * is also used elsewhere.
     */
    cloneMaterial?: boolean,
}

/**
 * A lazy-widgets Root which automatically manages a mesh and input. For an
 * example on how to use this in a component, see
 * example-components/test-ui-root.js
 *
 * Note that the properties object can also contain optional parameters for the
 * lazy-widgets Root constructor, and will be passed to it.
 *
 * If texture bleeding prevention is not specified, then it will be enabled by
 * default. Same applies for texture atlas bleeding prevention.
 *
 * If a pointer style handler is not specified, then a default pointer style
 * handler that changes the cursor style of the Wonderland Engine canvas will be
 * be used.
 */
export class WLRoot extends Root {
    /**
     * Get an HTML element that we can bind a KeyboardDriver to, or change the
     * pointer style in. Returns WL.canvas, with a fallback to the HTML body.
     */
    static get bindableElement(): HTMLElement {
        return WL.canvas ?? document.body;
    }

    /**
     * The shared PointerDriver instance. Getter only. The PointerDriver will
     * only be created when needed. Used for pointer (mouse & XR controller)
     * input.
     */
    static get pointerDriver(): PointerDriver {
        if(canvasUIPointerDriver === null) {
            canvasUIPointerDriver = new PointerDriver();
        }

        return canvasUIPointerDriver;
    }

    /**
     * The shared DOMKeyboardDriver instance. Getter only. The DOMKeyboardDriver
     * will only be created when needed. Used for keyboard input.
     */
    static get keyboardDriver(): DOMKeyboardDriver {
        if(canvasUIKeyboardDriver === null) {
            canvasUIKeyboardDriver = new DOMKeyboardDriver();
            canvasUIKeyboardDriver.bindDOMElem(WLRoot.bindableElement);
        }

        return canvasUIKeyboardDriver;
    }

    /**
     * A Map mapping each cursor component to a PointerDriver's pointer ID.
     */
    static get pointerIDs(): Map<object, number> {
        if(canvasUIPointerIDs === null) {
            canvasUIPointerIDs = new Map();
        }

        return canvasUIPointerIDs;
    }

    /**
     * Get the pointer ID assigned to a given cursor component. If the cursor
     * has no pointer ID assigned, a new pointer ID is registered to the
     * PointerDriver.
     * @param cursor - The cursor component
     */
    static getPointerID(cursor: object): number {
        const map = WLRoot.pointerIDs;
        let pointer = map.get(cursor);
        if(typeof pointer === 'undefined') {
            pointer = WLRoot.pointerDriver.registerPointer();
            //console.log('New pointer', pointer, 'registered for cursor', cursor);
            map.set(cursor, pointer);
        }

        return pointer;
    }

    unitsPerPixel: number;
    texture: any /*WL.Texture*/ | null = null;
    meshObject: any /*WL.Object*/ | null;
    mesh: any /*WL.Mesh*/ | null = null;
    meshComponent: any /*WL.MeshComponent*/ | null;
    materialClone: any /*WL.Material*/;
    oldTexSize: [number, number] = [0, 0];
    collision: any /*WL.CollisionComponent*/ | null = null;
    cursorTarget: CursorTargetComponent | null = null;

    protected valid = false;
    protected paintedOnce = false;
    private keydownEventListener: ((event: KeyboardEvent) => void) | null = null;
    private keyupEventListener: ((event: KeyboardEvent) => void) | null = null;
    private unHoverFunction: ((object: any /*WL.Object*/, cursor: CursorComponent) => void) | null = null;
    private moveFunction: ((object: any /*WL.Object*/, cursor: CursorComponent) => void) | null = null;
    private downFunction: ((object: any /*WL.Object*/, cursor: CursorComponent) => void) | null = null;
    private upFunction: ((object: any /*WL.Object*/, cursor: CursorComponent) => void) | null = null;
    private boundTo: HTMLElement;

    /**
     * @param wlObject - The object where the mesh will be added.
     * @param material - The material to use for this root's mesh. The material will be cloned.
     * @param child - The root's child widget.
     */
    constructor(wlObject: any /*WL.Object*/, material: any /*WL.Material*/, child: Widget, properties?: WLRootProperties) {
        properties = {
            pointerStyleHandler: style => {
                this.boundTo.style.cursor = style;
            },
            preventBleeding: true,
            preventAtlasBleeding: true,
            cloneMaterial: true,
            // Wonderland engine has much stricter texture limits because of the
            // texture atlas system. Limit canvas to 2048x2048 by default
            maxCanvasWidth: 2048,
            maxCanvasHeight: 2048,
            ...properties
        };

        super(child, properties);

        this.boundTo = WLRoot.bindableElement;
        addPasteEventListener(this.boundTo, this);

        const collisionGroup = properties.collisionGroup ?? 1;
        const registerPointerDriver = properties.registerPointerDriver ?? true;
        const registerKeyboardDriver = properties.registerKeyboardDriver ?? true;
        this.unitsPerPixel = properties.unitsPerPixel ?? 0.01;

        if (!WL.scene) {
            throw new Error('No scene available');
        }

        // Create the child object where the mesh and collider will be put.
        // Starts inactive since the mesh won't be ready yet
        this.meshObject = (WL.scene /*as WL.Scene*/).addObject(wlObject);
        this.meshObject.active = false;

        // Setup drivers
        if(collisionGroup !== null && registerPointerDriver) {
            this.registerDriver(WLRoot.pointerDriver);
        }
        if(registerKeyboardDriver) {
            this.registerDriver(WLRoot.keyboardDriver);
        }

        // Setup mesh for rendering in world
        this.meshComponent = this.meshObject.addComponent('mesh', {}) /*as WL.MeshComponent*/;
        this.meshComponent.active = false;

        // keep clone as a variable instead of accessing it later via
        // this.meshComponent.material because mesh's material setter wraps the
        // material, so it can't be reused. if cloneMaterial is false, the
        // actual material is used instead, which will lead to issues if the
        // material is reused elsewhere

        if (!material) {
            throw new Error('No material supplied');
        }

        if(properties.cloneMaterial) {
            const materialClone = material.clone();

            if (materialClone === null) {
                throw new Error('Could not clone material');
            }

            this.materialClone = materialClone;
        } else {
            this.materialClone = material;
        }

        this.meshComponent.material = this.materialClone;
        this._setupMesh(0, 1, 1, 0);

        // Setup mouse pointer input
        if(collisionGroup !== null) {
            this.collision = this.meshObject.addComponent('collision', {
                collider: WL.Collider.Box,
                extents: [1, 1, 0.01],
                group: 1 << collisionGroup,
            }) /*as WL.CollisionComponent*/;
            this.collision.active = false;

            // FIXME typescript shenanigans - remove typecasts when fixed official d.ts is available
            this.cursorTarget = this.meshObject.addComponent('cursor-target', {}) as unknown as CursorTargetComponent;
            this.cursorTarget.active = false;

            const cursorPos = new Float32Array(3);
            const pos = new Float32Array(3);
            const rot = new Float32Array(4);
            const meshObject = (this.meshObject /*as WL.Object*/);
            const getCursorPos = (cursor: CursorComponent): [number, number] => {
                cursorPos.set(cursor.rayHit.locations[0]);
                // FIXME typescript shenanigans - remove typecasts when fixed official d.ts is available
                meshObject.getTranslationWorld(pos as unknown as number[]);
                vec3.sub(cursorPos, cursorPos, pos);
                // FIXME typescript shenanigans - remove typecasts when fixed official d.ts is available
                quat.invert(rot, meshObject.rotationWorld as unknown as Float32Array);
                vec3.transformQuat(cursorPos, cursorPos, rot);
                vec3.div(cursorPos, cursorPos, meshObject.scalingWorld);

                return [
                    Math.min(Math.max((cursorPos[0] + 1) / 2, 0), 1),
                    Math.min(Math.max(1 - ((cursorPos[1] + 1) / 2), 0), 1),
                ];
            }

            if(registerPointerDriver) {
                let shift = false, ctrl = false, alt = false;

                this.keydownEventListener = (event: KeyboardEvent) => {
                    if(event.key === 'Shift') {
                        shift = true;
                    }
                    if(event.key === 'Control') {
                        ctrl = true;
                    }
                    if(event.key === 'Alt') {
                        alt = true;
                    }
                };

                this.keyupEventListener = (event: KeyboardEvent) => {
                    if(event.key === 'Shift') {
                        shift = false;
                    }
                    if(event.key === 'Control') {
                        ctrl = false;
                    }
                    if(event.key === 'Alt') {
                        alt = false;
                    }
                };

                this.boundTo.addEventListener('keydown', this.keydownEventListener);
                this.boundTo.addEventListener('keyup', this.keyupEventListener);

                this.unHoverFunction = (_: any /*WL.Object*/, cursor: CursorComponent) => {
                    WLRoot.pointerDriver.leavePointer(
                        this, WLRoot.getPointerID(cursor)
                    );
                };

                this.moveFunction = (_: any /*WL.Object*/, cursor: CursorComponent) => {
                    WLRoot.pointerDriver.movePointer(
                        this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), null, shift, ctrl, alt
                    );
                };

                this.downFunction = (_: any /*WL.Object*/, cursor: CursorComponent) => {
                    WLRoot.pointerDriver.movePointer(
                        this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), 1, shift, ctrl, alt
                    );
                };

                this.upFunction = (_: any /*WL.Object*/, cursor: CursorComponent) => {
                    WLRoot.pointerDriver.movePointer(
                        this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), 0, shift, ctrl, alt
                    );
                };

                this.cursorTarget.addUnHoverFunction(this.unHoverFunction);
                this.cursorTarget.addMoveFunction(this.moveFunction);
                this.cursorTarget.addDownFunction(this.downFunction);
                this.cursorTarget.addUpFunction(this.upFunction);
            }
        }

        this.valid = true;
    }


    /**
     * Do a full update of this root. Does a pre-layout update, resolves the
     * layout, does a post-layout update and paints. Call this instead of the
     * individual Root update methods.
     */
    update() {
        if(!this.valid || !this._enabled) {
            return;
        }

        // We know that this is `valid` and hence not null, typecast
        const meshObject = (this.meshObject /*as WL.Object*/);

        // Update (pre-layout)
        this.preLayoutUpdate();

        // Resolve layout
        const layoutDirty = this.resolveLayout();
        const [canvasWidth, canvasHeight] = this.canvasDimensions;
        if(layoutDirty) {
            //console.log('Root\'s layout was dirty, resizing');
            // Resize and update UV if layout was dirty so that UI is not
            // stretched
            const [width, height] = this.dimensions;
            const [scaleX, scaleY] = this.effectiveScale;
            meshObject.resetScaling();
            meshObject.scale([
                this.unitsPerPixel * width,
                this.unitsPerPixel * height,
                0.01,
            ]);

            if(this.collision !== null) {
                this.collision.extents = [
                    meshObject.scalingWorld[0],
                    meshObject.scalingWorld[1],
                    0.01,
                ];
            }

            let uBorder = 0, vBorder = 0;

            // XXX take offset from atlas bleeding prevention into account
            if (this.preventAtlasBleeding) {
                uBorder = 1 / this.canvas.width;
                vBorder = 1 / this.canvas.height;
            }

            const uSpan = scaleX * width / canvasWidth;
            const vSpan = scaleY * height / canvasHeight;

            this._setupMesh(uBorder, uBorder + uSpan, 1 - vBorder, 1 - vBorder - vSpan);
        }

        // Update (post-layout)
        this.postLayoutUpdate();

        // Paint
        const wasDirty = this.paint();

        if(!this.paintedOnce) {
            this.paintedOnce = true;
            meshObject.active = true;
        }

        if(!wasDirty) {
            return;
        }

        // Update texture if needed (if root was dirty)
        if(this.oldTexSize[0] !== canvasWidth || this.oldTexSize[1] !== canvasHeight) {
            this.oldTexSize[0] = canvasWidth;
            this.oldTexSize[1] = canvasHeight;
            const mat = this.materialClone;
            const oldTexture = this.texture;
            this.texture = new WL.Texture(this.canvas);
            if(mat.shader === 'Flat Opaque Textured' || mat.shader === 'Flat Transparent Textured') {
                (mat as FlatMaterial).flatTexture = this.texture;
            } else if(mat.shader == 'Phong Opaque Textured') {
                (mat as DiffuseMaterial).diffuseTexture = this.texture;
            } else {
                console.error('Shader', mat.shader, 'not supported by WLRoot');
            }

            // Destroy old texture so that there isn't an accumulation of
            // texture atlas usage over time
            if(oldTexture) {
                oldTexture.destroy();
            }
        } else if(this.texture) {
            //console.log('Root was dirty, updating texture');
            this.texture.update();
        } else {
            console.warn('There is no texture to update! Is the canvas dimensionless?');
        }
    }

    override set enabled(enabled: boolean) {
        super.enabled = enabled;

        if(this.paintedOnce) {
            (this.meshObject /*as WL.Object*/).active = this.enabled;
        }
    }

    override get enabled(): boolean {
        return super.enabled;
    }

    private _setupMesh(uLeft: number, uRight: number, vTop: number, vBottom: number) {
        const newMesh = new WL.Mesh({
            indexData: new Uint8Array([
                0, 3, 1, // top-right triangle
                0, 2, 3, // bottom-left triangle
            ]),
            indexType: WL.MeshIndexType.UnsignedByte,
            vertexCount: 4,
        });

        const positions = newMesh.attribute(WL.MeshAttribute.Position);
        if (!positions) {
            throw new Error('Could not get position mesh attribute accessor');
        }

        const normals = newMesh.attribute(WL.MeshAttribute.Normal);

        const texCoords = newMesh.attribute(WL.MeshAttribute.TextureCoordinate);
        if (!texCoords) {
            throw new Error('Could not get texture coordinate mesh attribute accessor');
        }

        // top-left
        positions.set(0, [-1, 1, 0]);
        texCoords.set(0, [uLeft, vTop]);
        // top-right
        positions.set(1, [1, 1, 0]);
        texCoords.set(1, [uRight, vTop]);
        // bottom-left
        positions.set(2, [-1, -1, 0]);
        texCoords.set(2, [uLeft, vBottom]);
        // bottom-right
        positions.set(3, [1, -1, 0]);
        texCoords.set(3, [uRight, vBottom]);

        if (normals) {
            normals.set(0, [0, 0, 1]); // tl
            normals.set(1, [0, 0, 1]); // tr
            normals.set(2, [0, 0, 1]); // bl
            normals.set(3, [0, 0, 1]); // br
        }

        (this.meshComponent /*as WL.MeshComponent*/).mesh = newMesh;

        if(this.mesh) {
            this.mesh.destroy();
        }

        this.mesh = newMesh;
    }

    override destroy(): void {
        // remove listeners
        removePasteEventListener(this.boundTo, this);

        if(this.keydownEventListener !== null) {
            this.boundTo.removeEventListener('keydown', this.keydownEventListener);
            this.keydownEventListener = null;
        }

        if(this.keyupEventListener !== null) {
            this.boundTo.removeEventListener('keyup', this.keyupEventListener);
            this.keyupEventListener = null;
        }

        if(this.cursorTarget) {
            if(this.unHoverFunction !== null) {
                this.cursorTarget.removeUnHoverFunction(this.unHoverFunction);
                this.unHoverFunction = null;
            }

            if(this.moveFunction !== null) {
                this.cursorTarget.removeMoveFunction(this.moveFunction);
                this.moveFunction = null;
            }

            if(this.downFunction !== null) {
                this.cursorTarget.removeDownFunction(this.downFunction);
                this.downFunction = null;
            }

            if(this.upFunction !== null) {
                this.cursorTarget.removeUpFunction(this.upFunction);
                this.upFunction = null;
            }
        }

        // destroy WLE objects
        if(this.texture) {
            this.texture.destroy();
            this.texture = null;
        }

        if(this.collision) {
            this.collision.destroy();
            this.collision = null;
        }

        if(this.cursorTarget) {
            this.cursorTarget.destroy();
            this.cursorTarget = null;
        }

        if(this.meshComponent) {
            this.meshComponent.destroy();
            this.meshComponent = null;
        }

        // FIXME material is not destroyed. find a way to do it

        if(this.mesh) {
            this.mesh.destroy();
        }

        if(this.meshObject) {
            this.meshObject.destroy();
            this.meshObject = null;
        }

        this.valid = false;
        this.paintedOnce = false;
        super.destroy();
    }
}
