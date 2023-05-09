import { Root, PointerDriver, DOMKeyboardDriver, DOMKeyboardDriverGroup, /*PointerWheelMode*/ } from 'lazy-widgets';
import { vec3, quat } from 'gl-matrix';
import { addPasteEventListener, removePasteEventListener } from './paste-event-listener.js';
import { Texture, Collider, Mesh, MeshAttribute, MeshIndexType } from '@wonderlandengine/api';
import { CursorTarget, EventTypes } from '@wonderlandengine/components';

import type { Widget, RootProperties } from 'lazy-widgets';
import type { Cursor } from '@wonderlandengine/components';
import type { Material, MeshComponent, CollisionComponent, Object as $Object, WonderlandEngine } from '@wonderlandengine/api';
import { BaseLazyWidgetsComponent } from '../components/BaseLazyWidgetsComponent.js';

// Drivers shared by all UI roots. For some reason, setting up the drivers here
// crashes Wonderland Editor. Instead, use WLRoot.pointerDriver/keyboardDriver
let pointerDriver: PointerDriver | null = null;
let keyboardDriver: DOMKeyboardDriver | null = null;
const keyboardDriverGroups = new WeakMap<WonderlandEngine, DOMKeyboardDriverGroup>();

// Mapping for 'cursor' components to lazy-widgets pointer IDs. Use
// WLRoot.pointerIDs or WLRoot.getPointerID(cursor)
let pointerIDs: Map<Cursor, number> | null = null;

const TMP_VEC = new Float32Array(4);

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
    /**
     * Which uniform name should be used for setting the material's texture? If
     * not passed, then the uniform name will be guessed from the pipeline name,
     * which will result in an error when an unknown pipeline is used.
     */
    textureUniformName?: string,
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
     * pointer style in. Returns canvas, with a fallback to the HTML body.
     */
    static getBindableElement(engine: WonderlandEngine): HTMLElement {
        return engine.canvas ?? document.body;
    }

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
                domElem: WLRoot.getBindableElement(engine),
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
            pointer = WLRoot.pointerDriver.registerPointer();
            //console.log('New pointer', pointer, 'registered for cursor', cursor);
            map.set(cursor, pointer);
        }

        return pointer;
    }

    unitsPerPixel: number;
    texture: Texture | null = null;
    meshObject: $Object | null;
    mesh: Mesh | null = null;
    meshComponent: MeshComponent | null;
    materialClone: Material;
    textureUniformName?: string;
    oldTexSize: [number, number] = [0, 0];
    collision: CollisionComponent | null = null;
    cursorTarget: CursorTarget | null = null;

    protected valid = false;
    protected paintedOnce = false;
    private keydownEventListener: ((event: KeyboardEvent) => void) | null = null;
    private keyupEventListener: ((event: KeyboardEvent) => void) | null = null;
    private unHoverFunction: ((object: $Object, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private moveFunction: ((object: $Object, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private downFunction: ((object: $Object, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private upFunction: ((object: $Object, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    // private wheelFunction: ((object: $Object, cursor: Cursor, ev?: EventTypes) => void) | null = null;
    private boundTo: HTMLElement;
    private lastWorldScale = new Float32Array(3);

    /**
     * @param wlObject - The object where the mesh will be added.
     * @param material - The material to use for this root's mesh. The material will be cloned.
     * @param child - The root's child widget.
     */
    constructor(private wlObject: $Object, material: Material, child: Widget, properties?: WLRootProperties) {
        properties = {
            pointerStyleHandler: style => {
                this.boundTo.style.cursor = style;
            },
            preventBleeding: true,
            preventAtlasBleeding: true,
            cloneMaterial: BaseLazyWidgetsComponent.Properties.cloneMaterial.default,
            // Wonderland engine has much stricter texture limits because of the
            // texture atlas system. Limit canvas to 2048x2048 by default
            maxCanvasWidth: 2048,
            maxCanvasHeight: 2048,
            ...properties
        };

        super(child, properties);

        this.boundTo = WLRoot.getBindableElement(wlObject.engine);
        addPasteEventListener(this.boundTo, this);

        let collisionGroup = properties.collisionGroup ?? BaseLazyWidgetsComponent.Properties.collisionGroup.default;
        if (collisionGroup < 0) {
            collisionGroup = null;
        }

        const registerPointerDriver = properties.registerPointerDriver ?? BaseLazyWidgetsComponent.Properties.registerPointerDriver.default;
        const registerKeyboardDriver = properties.registerKeyboardDriver ?? BaseLazyWidgetsComponent.Properties.registerKeyboardDriver.default;
        this.unitsPerPixel = properties.unitsPerPixel ?? BaseLazyWidgetsComponent.Properties.unitsPerPixel.default;
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
            const meshObject = (this.meshObject as $Object);
            const getCursorPos = (cursor: Cursor): [number, number] => {
                // TODO remove custom fix for wle-pp
                cursorPos.set((cursor as unknown as { _cursorPos: Float32Array })._cursorPos ?? cursor.cursorPos);
                meshObject.getTranslationWorld(TMP_VEC);
                vec3.sub(cursorPos, cursorPos, TMP_VEC);
                // TODO getRotationWorld is broken, use rotationWorld for now
                // meshObject.getRotationWorld(TMP_VEC);
                // quat.invert(rot, TMP_VEC);
                quat.invert(rot, meshObject.rotationWorld);
                vec3.transformQuat(cursorPos, cursorPos, rot);
                meshObject.getScalingWorld(TMP_VEC);
                vec3.div(cursorPos, cursorPos, TMP_VEC);

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

                this.unHoverFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    WLRoot.pointerDriver.leavePointer(
                        this, WLRoot.getPointerID(cursor)
                    );
                };

                this.moveFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    WLRoot.pointerDriver.movePointer(
                        this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), null, shift, ctrl, alt
                    );
                };

                this.downFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    WLRoot.pointerDriver.movePointer(
                        this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), 1, shift, ctrl, alt
                    );
                };

                this.upFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                    WLRoot.pointerDriver.movePointer(
                        this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), 0, shift, ctrl, alt
                    );
                };

                // this.wheelFunction = (_, cursor: Cursor, _ev?: EventTypes) => {
                //     WLRoot.pointerDriver.wheelPointer(
                //         this, WLRoot.getPointerID(cursor), ...getCursorPos(cursor), cursor.scrollDeltaX, cursor.scrollDeltaY, 0, PointerWheelMode.Pixel, shift, ctrl, alt
                //     );
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
        const meshObject = (this.meshObject as $Object);

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
            meshObject.setScalingLocal([
                this.unitsPerPixel * width,
                this.unitsPerPixel * height,
                0.01,
            ]);

            if(this.collision !== null) {
                meshObject.getScalingWorld(this.lastWorldScale);
                this.collision.extents = [ this.lastWorldScale[0], this.lastWorldScale[1], 0.01 ];
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

            if (diffSqr > 0.1) {
                // XXX can't use .set since TMP_VEC is a vec4, not a vec3
                this.lastWorldScale[0] = TMP_VEC[0];
                this.lastWorldScale[1] = TMP_VEC[1];
                this.lastWorldScale[2] = TMP_VEC[2];
                this.collision.extents = [ TMP_VEC[0], TMP_VEC[1], 0.01 ];
            }
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
            this.texture.update();
        } else {
            console.warn('There is no texture to update! Is the canvas dimensionless?');
        }
    }

    override set enabled(enabled: boolean) {
        super.enabled = enabled;

        if(this.paintedOnce) {
            (this.meshObject as $Object).active = this.enabled;
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
