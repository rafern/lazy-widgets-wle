import { Collider, Mesh, MeshAttribute, MeshIndexType, Texture, type CollisionComponent, type Material, type MeshComponent, type Object3D, type WonderlandEngine } from '@wonderlandengine/api';
import { CursorTarget, EventTypes, type Cursor } from '@wonderlandengine/components';
import { type ICursorStyleManager } from 'cursor-style-manager-wle';
import { quat, vec3 } from 'gl-matrix';
import { DOMKeyboardDriver, DOMKeyboardDriverGroup, FocusType, PointerDriver, Root, type RootProperties, type Widget } from 'lazy-widgets';
import { addPasteEventListener, removePasteEventListener } from './paste-event-listener.js';

// Drivers shared by all UI roots. For some reason, setting up the drivers here
// crashes Wonderland Editor. Instead, use WLRoot.pointerDriver/keyboardDriver
let pointerDriver: PointerDriver | null = null;
let keyboardDriver: DOMKeyboardDriver | null = null;
const keyboardDriverGroups = new WeakMap<WonderlandEngine, DOMKeyboardDriverGroup>();

// Mapping for 'cursor' components to lazy-widgets pointer IDs. Use
// WLRoot.pointerIDs or WLRoot.getPointerID(cursor)
let pointerIDs: Map<Cursor, number> | null = null;

const TMP_VEC = new Float32Array(4);
const TMP_VEC_2 = new Float32Array(3);

const DEFAULT_TEXTURE_UNIFORMS = new Map<string, string>([
    ['Flat Opaque Textured', 'flatTexture'],
    ['Phong Opaque Textured', 'diffuseTexture'],
    ['Physical Opaque Textured', 'albedoTexture'],
    ['Flat Transparent Textured', 'flatTexture'],
    ['Phong Transparent Textured', 'diffuseTexture'],
    ['Physical Transparent Textured', 'albedoTexture'],
    ['Phong Normalmapped', 'diffuseTexture'],
    ['Phong Lightmapped', 'diffuseTexture'],
]);

/**
 * Optional WLRoot constructor properties.
 *
 * @category Core
 */
export interface WLRootProperties extends RootProperties {
    /**
     * The amount of world units per canvas pixel. Determines the pixel density
     * of the mesh.
     */
    unitsPerPixel?: number,
    /**
     * The collision group that this root's collider will belong to. If null,
     * collider and cursor-target will not be added.
     */
    collisionGroup?: number,
    /**
     * Register the default pointer driver to this root? If collisionGroup is
     * null, this is forced to false.
     */
    registerPointerDriver?: boolean,
    /** Register the default keyboard driver to this root? */
    registerKeyboardDriver?: boolean,
    /**
     * Should the material used for the Root be cloned? If false, then the
     * actual material will be used, which will lead to issues if the material
     * is also used elsewhere.
     */
    cloneMaterial?: boolean,
    /**
     * Which uniform name should be used for setting the material's texture? If
     * not passed, then the uniform name will be guessed from the pipeline name,
     * which will result in an error when an unknown pipeline is used.
     */
    textureUniformName?: string,
    /**
     * A cursor style manager for sharing the cursor style with other components
     * without having a glitchy cursor style. If omitted and the pointer style
     * handler is not overridden, then the cursor style is set directly.
     *
     * Even if the pointerStyleHandler is overridden, this should still be
     * passed if it's available, so that the root can clear the pointer style
     * when it's disabled.
     */
    cursorStyleManager?: ICursorStyleManager | null,
    /**
     * When true, the UI texture will be destroyed to clear up space in the
     * texture atlas whenever the UI root is disabled. Note that this will cause
     * additional texture updates when re-enabling the UI root.
     */
    destroyTextureWhenDisabled?: boolean,
    /**
     * How many pixels to over-extend the collision by. For example, if 2, and
     * the units-per-pixel is 0.01, then the collision extents will be expanded
     * by 0.02 game units on all sides.
     */
    collisionOverextensionPixels?: number;
    /**
     * Should the collision extents only be expanded when the cursor is being
     * captured?
     */
    overextendCollisionOnCursorCapture?: boolean;
    /**
     * Should contentEditable be set to true? Needed for paste events, but
     * creates issues on mobile; virtual keyboard is opened whenever the canvas
     * is clicked. Disabled by default
     */
    enablePasteEvents?: boolean;
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
    /** Default units-per-pixel */
    static readonly defaultUnitsPerPixel = 0.01;
    /** Default collision group */
    static readonly defaultCollisionGroup = 1;
    /** Are materials cloned by default? */
    static readonly defaultCloneMaterial = true;
    /** Are pointer drivers auto-registered by default? */
    static readonly defaultRegisterPointerDriver = true;
    /** Are keyboard drivers auto-registered by default? */
    static readonly defaultRegisterKeyboardDriver = true;
    /** Is texture bleeding from old content prevented by default? */
    static readonly defaultPreventBleeding = true;
    /** Is texture bleeding from the texture atlas prevented by default? */
    static readonly defaultPreventAtlasBleeding = true;
    /**
     * The resolution of the canvas. For example, if 2, then the resolution of
     * the canvas will be doubled. If 0.5, then the resolution of the canvas
     * will be halved.
     */
    static readonly defaultResolution = 1;
    /**
     * Default maximum canvas (texture) width. Smaller than lazy-widget's
     * default value because Wonderland engine has much stricter texture limits
     * due to the texture atlas system.
     */
    static readonly defaultMaxCanvasWidth = 2048;
    /**
     * Default maximum canvas (texture) height. Smaller than lazy-widget's
     * default value because Wonderland engine has much stricter texture limits
     * due to the texture atlas system.
     */
    static readonly defaultMaxCanvasHeight = 2048;
    /**
     * Should the UI texture be destroyed by default when the root is disabled?
     */
    static readonly defaultDestroyTextureWhenDisabled = false;
    /** How many pixels to over-extend the collision extents by default. */
    static readonly defaultCollisionOverextensionPixels = 16;
    /**
     * Should the collision extents only be over-extended when the cursor is
     * being captured by default?
     */
    static readonly defaultOverextendCollisionOnCursorCapture = true;

    /**
     * The shared PointerDriver instance. Getter only. The PointerDriver will
     * only be created when needed. Used for pointer (mouse & XR controller)
     * input.
     */
    static get pointerDriver(): PointerDriver {
        if(pointerDriver === null) {
            pointerDriver = new PointerDriver();
        }

        return pointerDriver;
    }

    /**
     * The shared DOMKeyboardDriverGroup instance. Getter only. The
     * DOMKeyboardDriverGroup will only be created when needed. Used for
     * keyboard input.
     */
    static getKeyboardDriverGroup(engine: WonderlandEngine): DOMKeyboardDriverGroup {
        let keyboardDriverGroup = keyboardDriverGroups.get(engine);
        if (keyboardDriverGroup === undefined) {
            keyboardDriverGroup = WLRoot.keyboardDriver.createGroup({
                domElem: engine.canvas,
                wrapsAround: true
            });

            keyboardDriverGroups.set(engine, keyboardDriverGroup);
        }

        return keyboardDriverGroup;
    }

    /**
     * The shared DOMKeyboardDriver instance. Getter only. The DOMKeyboardDriver
     * will only be created when needed. Used for keyboard input.
     */
    static get keyboardDriver(): DOMKeyboardDriver {
        if(keyboardDriver === null) {
            keyboardDriver = new DOMKeyboardDriver();
        }

        return keyboardDriver;
    }

    /**
     * A Map mapping each cursor component to a PointerDriver's pointer ID.
     */
    static get pointerIDs(): Map<Cursor, number> {
        if(pointerIDs === null) {
            pointerIDs = new Map();
        }

        return pointerIDs;
    }

    /**
     * Get the pointer ID assigned to a given cursor component. If the cursor
     * has no pointer ID assigned, a new pointer ID is registered to the
     * PointerDriver.
     * @param cursor - The cursor component
     */
    static getPointerID(cursor: Cursor): number {
        const map = WLRoot.pointerIDs;
        let pointer = map.get(cursor);
        if(typeof pointer === 'undefined') {
            // TODO allow dragToScroll to be enabled somehow
            pointer = WLRoot.pointerDriver.registerPointer();
            //console.log('New pointer', pointer, 'registered for cursor', cursor);
            map.set(cursor, pointer);
        }

        return pointer;
    }

    unitsPerPixel: number;
    protected texture: Texture | null = null;
    protected meshObject: Object3D | null;
    protected mesh: Mesh | null = null;
    protected meshComponent: MeshComponent | null;
    protected materialClone: Material;
    textureUniformName?: string;
    protected oldTexSize: [number, number] = [0, 0];
    protected collision: CollisionComponent | null = null;
    protected cursorTarget: CursorTarget | null = null;
    destroyTextureWhenDisabled: boolean;
    protected valid = false;
    protected paintedOnce = false;
    private keydownEventListener: ((event: KeyboardEvent) => void) | null = null;
    private keyupEventListener: ((event: KeyboardEvent) => void) | null = null;
    private unHoverFunction: ((object: Object3D, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private moveFunction: ((object: Object3D, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private downFunction: ((object: Object3D, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private upFunction: ((object: Object3D, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    // private wheelFunction: ((object: Object3D, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private boundTo: HTMLElement;
    private lastWorldScale = new Float32Array(3);
    private cursorStyleManager: ICursorStyleManager | null;
    private lastUnitsPerPixel: number;
    collisionOverextensionPixels: number;
    overextendCollisionOnCursorCapture: boolean;
    private curCollisionOverextension = 0;
    private hasPasteEvents = false;

    /**
     * @param wlObject - The object where the mesh will be added.
     * @param material - The material to use for this root's mesh. The material will be cloned.
     * @param child - The root's child widget.
     */
    constructor(private wlObject: Object3D, material: Material, child: Widget, properties?: WLRootProperties) {
        const cursorStyleManager = properties?.cursorStyleManager ?? null;

        properties = {
            pointerStyleHandler: style => {
                if (cursorStyleManager) {
                    cursorStyleManager.setStyle(this, style);
                } else {
                    this.boundTo.style.cursor = style;
                }
            },
            preventBleeding: WLRoot.defaultPreventBleeding,
            preventAtlasBleeding: WLRoot.defaultPreventAtlasBleeding,
            cloneMaterial: WLRoot.defaultCloneMaterial,
            resolution: WLRoot.defaultResolution,
            maxCanvasWidth: WLRoot.defaultMaxCanvasWidth,
            maxCanvasHeight: WLRoot.defaultMaxCanvasHeight,
            ...properties
        };

        super(child, properties);

        this.collisionOverextensionPixels = properties.collisionOverextensionPixels ?? WLRoot.defaultCollisionOverextensionPixels;
        this.overextendCollisionOnCursorCapture = properties.overextendCollisionOnCursorCapture ?? WLRoot.defaultOverextendCollisionOnCursorCapture;
        this.destroyTextureWhenDisabled = properties.destroyTextureWhenDisabled ?? WLRoot.defaultDestroyTextureWhenDisabled;
        this.cursorStyleManager = cursorStyleManager;
        this.boundTo = wlObject.engine.canvas;

        if (properties?.enablePasteEvents) {
            addPasteEventListener(this.boundTo, this);
            this.hasPasteEvents = true;
        }

        let collisionGroup: number | null = properties.collisionGroup ?? WLRoot.defaultCollisionGroup;
        if (collisionGroup < 0) {
            collisionGroup = null;
        }

        const registerPointerDriver = properties.registerPointerDriver ?? WLRoot.defaultRegisterPointerDriver;
        const registerKeyboardDriver = properties.registerKeyboardDriver ?? WLRoot.defaultRegisterKeyboardDriver;
        this.unitsPerPixel = properties.unitsPerPixel ?? WLRoot.defaultUnitsPerPixel;
        this.lastUnitsPerPixel = this.unitsPerPixel;
        this.textureUniformName = properties.textureUniformName;

        if (this.textureUniformName === '') {
            this.textureUniformName = undefined;
        }

        const engine = wlObject.engine;

        if (!engine.scene) {
            throw new Error('No scene available');
        }

        // Create the child object where the mesh and collider will be put.
        // Starts inactive since the mesh won't be ready yet
        this.meshObject = engine.scene.addObject(wlObject);
        this.meshObject.active = false;

        // Setup drivers
        if(collisionGroup !== null && registerPointerDriver) {
            this.registerDriver(WLRoot.pointerDriver);
        }

        if(registerKeyboardDriver) {
            const kb = WLRoot.keyboardDriver;
            kb.bindRoot(this, WLRoot.getKeyboardDriverGroup(wlObject.engine));
            this.registerDriver(kb);
        }

        // Setup mesh for rendering in world
        this.meshComponent = this.meshObject.addComponent('mesh', {});

        if (this.meshComponent === null) {
            throw new Error('Failed to add mesh component');
        }

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
                collider: Collider.Box,
                extents: [1, 1, 0.01],
                group: 1 << collisionGroup,
            });

            if (this.collision === null) {
                throw new Error('Failed to add collision component');
            }

            this.collision.active = false;

            this.cursorTarget = this.meshObject.addComponent(CursorTarget, {});

            if (this.cursorTarget === null) {
                throw new Error('Failed to add cursor-target component');
            }

            this.cursorTarget.active = false;

            const cursorPos = new Float32Array(3);
            const rot = new Float32Array(4);
            const meshObject = (this.meshObject as Object3D);
            const getCursorPos = (cursor: Cursor): [number, number] => {
                cursorPos.set(cursor.cursorPos);
                meshObject.getPositionWorld(TMP_VEC);
                vec3.sub(cursorPos, cursorPos, TMP_VEC);
                meshObject.getRotationWorld(TMP_VEC);
                quat.invert(rot, TMP_VEC);
                vec3.transformQuat(cursorPos, cursorPos, rot);
                meshObject.getScalingWorld(TMP_VEC);
                vec3.div(cursorPos, cursorPos, TMP_VEC);

                return [ (cursorPos[0] + 1) / 2, 1 - ((cursorPos[1] + 1) / 2) ];
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

                this.boundTo.addEventListener('keydown', this.keydownEventListener, {
                    passive: true, capture: true,
                });
                this.boundTo.addEventListener('keyup', this.keyupEventListener, {
                    passive: true, capture: true,
                });

                this.unHoverFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    WLRoot.pointerDriver.leavePointer(
                        this, WLRoot.getPointerID(cursor)
                    );

                    if (this.cursorStyleManager) {
                        this.cursorStyleManager.clearStyle(this);
                    }
                };

                this.moveFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    if (this._testRayDirection(cursor)) {
                        WLRoot.pointerDriver.movePointer(
                            this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), null, shift, ctrl, alt
                        );
                    }
                };

                this.downFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    if (this._testRayDirection(cursor)) {
                        WLRoot.pointerDriver.movePointer(
                            this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), 1, shift, ctrl, alt
                        );
                    }
                };

                this.upFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    if (this._testRayDirection(cursor)) {
                        WLRoot.pointerDriver.movePointer(
                            this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), 0, shift, ctrl, alt
                        );
                    }
                };

                // this.wheelFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                //     if (this._testRayDirection(cursor)) {
                //         WLRoot.pointerDriver.wheelPointer(
                //             this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), cursor.scrollDeltaX, cursor.scrollDeltaY, 0, PointerWheelMode.Pixel, shift, ctrl, alt
                //         );
                //     }
                // };

                this.cursorTarget.onUnhover.add(this.unHoverFunction);
                this.cursorTarget.onMove.add(this.moveFunction);
                this.cursorTarget.onDown.add(this.downFunction);
                this.cursorTarget.onUp.add(this.upFunction);
                // this.cursorTarget.onScroll.add(this.wheelFunction);
            }
        }

        this.valid = true;
    }

    private getEffectiveCollisionOverextension() {
        if (!this.overextendCollisionOnCursorCapture || this._foci.get(FocusType.Pointer)) {
            return Math.max(0, this.collisionOverextensionPixels);
        } else {
            return 0;
        }
    }

    private updateCollisionExtents(effOverextend: number, width: number, height: number) {
        this.curCollisionOverextension = effOverextend;
        const oxPixels2 = effOverextend * 2;
        const oxWidth = oxPixels2 + width;
        const oxHeight = oxPixels2 + height;
        const oxWMul = oxWidth / width;
        const oxHMul = oxHeight / height;

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        this.collision!.extents = [
            this.lastWorldScale[0] * oxWMul,
            this.lastWorldScale[1] * oxHMul,
            0.01,
        ];
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
        const meshObject = this.meshObject as Object3D;

        // Update (pre-layout)
        this.preLayoutUpdate();

        // Resolve layout
        const layoutDirty = this.resolveLayout();
        const [canvasWidth, canvasHeight] = this.canvasDimensions;
        if(layoutDirty || this.lastUnitsPerPixel !== this.unitsPerPixel) {
            //console.log("Root's layout was dirty, resizing");
            // Resize and update UV if layout was dirty so that UI is not
            // stretched
            const [width, height] = this.dimensions;
            const [scaleX, scaleY] = this.effectiveScale;
            meshObject.resetScaling();
            meshObject.setScalingLocal([
                this.unitsPerPixel * width,
                this.unitsPerPixel * height,
                0.01,
            ]);
            this.lastUnitsPerPixel = this.unitsPerPixel;

            if(this.collision !== null) {
                meshObject.getScalingWorld(this.lastWorldScale);
                const effOverextend = this.getEffectiveCollisionOverextension();
                this.updateCollisionExtents(effOverextend, width, height);
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
        } else if(this.collision !== null) {
            meshObject.getScalingWorld(TMP_VEC);
            const diffSqr = Math.abs(TMP_VEC[0] - this.lastWorldScale[0]) + Math.abs(TMP_VEC[1] - this.lastWorldScale[1]);
            const effOverextend = this.getEffectiveCollisionOverextension();

            if (diffSqr > 0.1 || this.curCollisionOverextension !== effOverextend) {
                // XXX can't use .set since TMP_VEC is a vec4, not a vec3
                this.lastWorldScale[0] = TMP_VEC[0];
                this.lastWorldScale[1] = TMP_VEC[1];
                this.lastWorldScale[2] = TMP_VEC[2];
                const [width, height] = this.dimensions;
                this.updateCollisionExtents(effOverextend, width, height);
            }
        }

        // Update (post-layout)
        this.postLayoutUpdate();

        // Paint
        const dirtyRects = this.paint();

        if(!this.paintedOnce) {
            this.paintedOnce = true;
            meshObject.active = true;
        }

        if(!dirtyRects) {
            return;
        }

        // Update texture if needed (if root was dirty)
        if(this.oldTexSize[0] !== canvasWidth || this.oldTexSize[1] !== canvasHeight) {
            this.oldTexSize[0] = canvasWidth;
            this.oldTexSize[1] = canvasHeight;
            const mat = this.materialClone;
            const oldTexture = this.texture;
            this.texture = new Texture(this.wlObject.engine, this.canvas);

            const textureUniformName = this.textureUniformName ?? DEFAULT_TEXTURE_UNIFORMS.get(mat.pipeline);
            if (textureUniformName === undefined) {
                console.error(`Pipeline "${mat.pipeline}" not supported by WLRoot without specifying a texture uniform name (textureUniformName property)`);
            } else {
                (mat as unknown as Record<string, Texture>)[textureUniformName] = this.texture;
            }

            // Destroy old texture so that there isn't an accumulation of
            // texture atlas usage over time
            if(oldTexture) {
                oldTexture.destroy();
            }
        } else if(this.texture) {
            //console.log('Root was dirty, updating texture');
            if (dirtyRects.length > 3) {
                // XXX we want to avoid a scenario where there are many small
                //     updates to the texture, which makes overall texture
                //     updating slower due to the overhead of updateSubImage. if
                //     there too many dirty rectangles, then merge all of them
                //     into a single large dirty rectangle
                let left = Infinity, right = -Infinity, top = Infinity, bottom = -Infinity;
                for (const dirtyRect of dirtyRects) {
                    const [x, y, width, height] = dirtyRect;
                    left = Math.min(x, left);
                    right = Math.max(x + width, right);
                    top = Math.min(y, top);
                    bottom = Math.max(y + height, bottom);
                }

                const width = right - left;
                const height = bottom - top;
                // console.warn(`Too many dirty rectangles, merged into a single dirty rectangle - ${width}x${height}@${left},${top}`);
                this.texture.updateSubImage(left, top, width, height);
            } else {
                for (const dirtyRect of dirtyRects) {
                    this.texture.updateSubImage(...dirtyRect);
                }
            }
        } else {
            console.warn('There is no texture to update! Is the canvas dimensionless?');
        }
    }

    override set enabled(enabled: boolean) {
        if (this._enabled !== enabled) {
            super.enabled = enabled;

            if(this.paintedOnce) {
                (this.meshObject as Object3D).active = this.enabled;
            }

            if (this.cursorStyleManager && !enabled) {
                this.cursorStyleManager.clearStyle(this);
            }

            if (this.destroyTextureWhenDisabled && !enabled) {
                this.destroyTexture();
            }
        }
    }

    override get enabled(): boolean {
        return super.enabled;
    }

    private _setupMesh(uLeft: number, uRight: number, vTop: number, vBottom: number) {
        const newMesh = new Mesh(this.wlObject.engine, {
            indexData: new Uint8Array([
                0, 3, 1, // top-right triangle
                0, 2, 3, // bottom-left triangle
            ]),
            indexType: MeshIndexType.UnsignedByte,
            vertexCount: 4,
        });

        const positions = newMesh.attribute(MeshAttribute.Position);
        if (!positions) {
            throw new Error('Could not get position mesh attribute accessor');
        }

        const normals = newMesh.attribute(MeshAttribute.Normal);

        const texCoords = newMesh.attribute(MeshAttribute.TextureCoordinate);
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

        (this.meshComponent as MeshComponent).mesh = newMesh;

        if(this.mesh) {
            this.mesh.destroy();
        }

        this.mesh = newMesh;
    }

    private _testRayDirection(cursor: Cursor): boolean {
        if (this.meshObject) {
            cursor.object.getPositionWorld(TMP_VEC);
            vec3.sub(TMP_VEC, TMP_VEC, cursor.cursorPos);
            this.meshObject.getForwardWorld(TMP_VEC_2);
            return vec3.dot(TMP_VEC, TMP_VEC_2) < 0;
        } else {
            return false;
        }
    }

    override destroy(): void {
        // remove listeners
        if (this.hasPasteEvents) {
            this.hasPasteEvents = false;
            removePasteEventListener(this.boundTo, this);
        }

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
                this.cursorTarget.onUnhover.remove(this.unHoverFunction);
                this.unHoverFunction = null;
            }

            if(this.moveFunction !== null) {
                this.cursorTarget.onMove.remove(this.moveFunction);
                this.moveFunction = null;
            }

            if(this.downFunction !== null) {
                this.cursorTarget.onDown.remove(this.downFunction);
                this.downFunction = null;
            }

            if(this.upFunction !== null) {
                this.cursorTarget.onUp.remove(this.upFunction);
                this.upFunction = null;
            }

            // if(this.wheelFunction !== null) {
            //     this.cursorTarget.onScroll.remove(this.wheelFunction);
            //     this.wheelFunction = null;
            // }
        }

        // destroy WLE objects
        this.destroyTexture();

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

        // TODO if materials become a destroyable resource, destroy them here

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

    /**
     * Destroy the texture used by this UI root, or do nothing if there is no
     * texture created. The UI root will still be usable after calling this, as
     * the texture is auto-created when needed.
     *
     * Use this if you want to save atlas space for a disabled UI root. If this
     * is your use-case, and the UI root is not frequently toggled, consider
     * using the {@link WLRoot#destroyTextureWhenDisabled} option.
     */
    destroyTexture() {
        if (!this.texture) {
            return;
        }

        this.oldTexSize[0] = 0;
        this.oldTexSize[1] = 0;
        this.texture.destroy();
        this.texture = null;
    }

    /**
     * Get the collision component used for detecting cursor input. Will be null
     * if a {@link WLRootProperties#collisionGroup} is not provided when
     * creating this WLRoot.
     */
    getCollider() {
        return this.collision;
    }
}
