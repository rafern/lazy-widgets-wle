import { Component, type Material, type Object3D, type WonderlandEngine } from '@wonderlandengine/api';
import { property } from '@wonderlandengine/api/decorators.js';
import { CursorTarget } from '@wonderlandengine/components';
import { type Widget } from 'lazy-widgets';
import { makeLWWLEErrMsg } from '../core/makeLWWLEErrMsg.js';
import { WLRoot, type WLRootProperties } from '../core/WLRoot.js';

/**
 * The base component for a lazy-widgets UI, with no editor properties for
 * toggling drivers. Useful for virtual keyboard UI roots, where drivers should
 * never be disabled
 */
export abstract class NoDriverPropsBaseLazyWidgetsComponent<WLRootType extends WLRoot = WLRoot, WLRootPropertiesType extends WLRootProperties = WLRootProperties> extends Component {
    /** Material to apply the canvas texture to */
    @property.material()
    material!: Material;
    /**
     * The amount of world units per canvas pixel. Determines the pixel density
     * of the mesh.
     */
    @property.float(WLRoot.defaultUnitsPerPixel)
    unitsPerPixel!: number;
    /**
     * The collision groups that this root's collider will belong to. If 0,
     * collider and cursor-target will not be added.
     */
    @property.int(WLRoot.defaultCollisionGroupsMask)
    collisionGroupsMask!: number;
    /**
     * Should the material used for the Root be cloned? If false, then the
     * actual material will be used, which will lead to issues if the material
     * is also used elsewhere.
     */
    @property.bool(WLRoot.defaultCloneMaterial)
    cloneMaterial!: boolean;
    /**
     * Which uniform name should be used for setting the material's texture? If
     * not passed, then the uniform name will be guessed from the pipeline name,
     * which will result in an error when an unknown pipeline is used.
     */
    @property.string()
    textureUniformName!: string;
    /** Object with cursor style manager */
    @property.object()
    cursorStyleManagerObject!: Object3D | null;
    /** Component name for cursor style manager */
    @property.string('cursor-style-manager')
    cursorStyleManagerName!: string;
    /**
     * Should texture bleeding introduced from old content be prevented by
     * clearing areas with old content?
     */
    @property.bool(WLRoot.defaultPreventBleeding)
    preventBleeding!: boolean;
    /**
     * Should texture bleeding introduced from the texture atlas be prevented by
     * adding a transparent black 1 pixel border to the canvas?
     */
    @property.bool(WLRoot.defaultPreventAtlasBleeding)
    preventAtlasBleeding!: boolean;
    /**
     * The resolution of the canvas. For example, if 2, then the resolution of
     * the canvas will be doubled. If 0.5, then the resolution of the canvas
     * will be halved.
     */
    @property.float(WLRoot.defaultResolution)
    resolution!: number;
    /** Minimum layout width. Must be a number greater or equal to 0. */
    @property.float(0)
    minWidth!: number;
    /**
     * Maximum layout width. Must be a number greater than 0, or 0 if there is
     * no maximum width.
     */
    @property.float(0)
    maxWidth!: number;
    /** Minimum layout height. Must be a number greater or equal to 0. */
    @property.float(0)
    minHeight!: number;
    /**
     * Maximum layout height. Must be a number greater than 0, or 0 if there is
     * no maximum height.
     */
    @property.float(0)
    maxHeight!: number;
    /**
     * Maximum canvas (texture) width. If the width is exceeded, then the
     * contents will be squeezed automatically to fit the texture.
     */
    @property.int(WLRoot.defaultMaxCanvasWidth)
    maxCanvasWidth!: number;
    /**
     * Maximum canvas (texture) height. If the height is exceeded, then the
     * contents will be squeezed automatically to fit the texture.
     */
    @property.int(WLRoot.defaultMaxCanvasHeight)
    maxCanvasHeight!: number;
    /**
     * When true, the UI texture will be destroyed to clear up space in the
     * texture atlas whenever the UI root is disabled. Note that this will cause
     * additional texture updates when re-enabling the UI root.
     */
    @property.bool(WLRoot.defaultDestroyTextureWhenDisabled)
    destroyTextureWhenDisabled!: boolean;
    /**
     * How many pixels to over-extend the collision by. For example, if 2, and
     * the units-per-pixel is 0.01, then the collision extents will be expanded
     * by 0.02 game units on all sides.
     */
    @property.float(WLRoot.defaultCollisionOverextensionPixels)
    collisionOverextensionPixels!: number;
    /**
     * Should the collision extents only be expanded when the cursor is being
     * captured?
     */
    @property.bool(WLRoot.defaultOverextendCollisionOnCursorCapture)
    overextendCollisionOnCursorCapture!: boolean;

    /**
     * The lazy-widgets UI root.
     *
     * If initialization failed, this will be undefined. Make sure to guard
     * references to this in case initialization fails, so that the console
     * isn't spammed with errors unrelated to the failed initialization.
     */
    protected root?: WLRootType;
    /**
     * Was super.init() called? Used to warn users of incorrect component
     * implementation.
     */
    private superInitCalled = false;
    /**
     * Do we want the root to be enabled when it's created? Used to handle root
     * toggling when the root isn't loaded yet
     */
    protected wantEnabled = false;

    static override onRegister(engine: WonderlandEngine) {
        engine.registerComponent(CursorTarget);
    }

    override init() {
        this.superInitCalled = true;

        const material = this.material;
        if (!material) {
            throw new Error(makeLWWLEErrMsg(this, 'has no material set', 'Make sure that the "material" property is set in the editor. If you are overriding the component "Properties", make sure that you have a "material" property'));
        }

        const properties = this.getRootProperties();
        if (properties === null || typeof properties !== 'object') {
            throw new Error(makeLWWLEErrMsg(this, 'returned an invalid properties object on getRootProperties', "Make sure to return a plain object with the wanted properties, or don't override the method if no additional properties are needed"));
        }

        Promise.resolve(this.createWLRoot(material, properties)).then(root => {
            if (!root) {
                throw new Error(makeLWWLEErrMsg(this, 'returned no WLRoot on createWLRoot', "Make sure to return the created WLRoot in the createWLRoot method, or don't override the method if you only need to use the default WLRoot class. Only override the createWLRoot method if you really need to, and if you know what you're doing"));
            }

            this.root = root;
            root.enabled = this.wantEnabled;
            this.onRootReady(root);
        });
    }

    private guardRoot(root?: WLRootType): root is WLRootType {
        if (root) {
            return true;
        } else {
            if (!this.superInitCalled) {
                this.superInitCalled = true;
                console.error(makeLWWLEErrMsg(this, 'did not call super.init()', "Make sure to call super.init() when overriding the init method in you child class. This error will only be shown once for this component"));
            }

            return false;
        }
    }

    private doRootUpdate(dt: number): void {
        const root = this.root as WLRootType;
        const beforeUpdateRet = this.beforeWidgetUpdate(root, dt);

        if (beforeUpdateRet || beforeUpdateRet === undefined) {
            root.update();
            this.afterWidgetUpdate(root, dt);
        }
    }

    override update(dt: number) {
        if(this.guardRoot(this.root)) {
            this.doRootUpdate(dt);
        }
    }

    override onActivate() {
        this.wantEnabled = true;
        if(this.guardRoot(this.root)) {
            this.root.enabled = true;
            // XXX need to force an update here otherwise there is a single
            //     frame with old content
            this.doRootUpdate(0);
        }
    }

    override onDeactivate() {
        this.wantEnabled = false;
        if(this.guardRoot(this.root)) {
            this.root.enabled = false;
        }
    }

    /**
     * Similar to createWidget, except this method should be called instead of
     * createWidget. If you are looking for a method to override and create a
     * new widget, then override createWidget instead of this method.
     */
    protected async createWidgetGuarded(properties?: WLRootPropertiesType): Promise<Widget> {
        const widget = this.createWidget(properties);
        if (!widget) {
            throw new Error(makeLWWLEErrMsg(this, 'returned no widget on createWidget', 'Make sure to return the created widget in the createWidget method'));
        }

        return widget;
    }

    /**
     * Create the child widget to use for the WLRoot of this UI. Must be
     * implemented by child class. Note that if createWLRoot doesn't need a
     * widget, then this won't be called and the method doesn't have to be
     * implemented.
     */
    protected async createWidget(_properties?: WLRootPropertiesType): Promise<Widget> {
        throw new Error(makeLWWLEErrMsg(this, 'does not implement the createWidget method', 'Override the createWidget method to create the main widget for the UI root, and return it'));
    }

    /**
     * Create the WLRoot to use for this UI. Can optionally be overridden by
     * child class, but creates a WLRoot by default. If overriding and the
     * WLRoot needs a widget created by the user, then call createWidgetGuarded
     * to get a widget.
     */
    protected async createWLRoot(material: Material, properties: WLRootPropertiesType): Promise<WLRootType> {
        return new WLRoot(this.object, material, await this.createWidgetGuarded(properties), properties) as WLRootType;
    }

    /**
     * Get the properties to use for the WLRoot of this UI. Can optionally be
     * implemented by child class. If not implemented, then the default options
     * are used for the WLRoot, as well as some properties from the component
     * specific to the Wonderland Engine integration.
     */
    protected getRootProperties(): WLRootPropertiesType {
        const constraints = [this.minWidth, this.maxWidth, this.minHeight, this.maxHeight];

        if (constraints[0] < 0) {
            throw new Error('Minimum width must be greater or equal to 0');
        }
        if (constraints[1] < 0) {
            throw new Error('Maximum width must be greater or equal to 0');
        }
        if (constraints[2] < 0) {
            throw new Error('Minimum height must be greater or equal to 0');
        }
        if (constraints[3] < 0) {
            throw new Error('Maximum height must be greater or equal to 0');
        }

        if (constraints[1] === 0) {
            constraints[1] = Infinity;
        }
        if (constraints[3] === 0) {
            constraints[3] = Infinity;
        }

        return {
            unitsPerPixel: this.unitsPerPixel,
            collisionGroupsMask: this.collisionGroupsMask,
            cloneMaterial: this.cloneMaterial,
            textureUniformName: this.textureUniformName,
            cursorStyleManager: this.cursorStyleManagerObject?.getComponent(this.cursorStyleManagerName),
            preventBleeding: this.preventBleeding,
            preventAtlasBleeding: this.preventAtlasBleeding,
            resolution: this.resolution,
            maxCanvasWidth: this.maxCanvasWidth,
            maxCanvasHeight: this.maxCanvasHeight,
            destroyTextureWhenDisabled: this.destroyTextureWhenDisabled,
            collisionOverextensionPixels: this.collisionOverextensionPixels,
            overextendCollisionOnCursorCapture: this.overextendCollisionOnCursorCapture,
            constraints,
        } as WLRootPropertiesType;
    }

    /**
     * Called before a lazy-widgets update is done on this UI root. Can
     * optionally be implemented by child class. If any falsy value other than
     * undefined is returned, then the update is skipped.
     */
    protected beforeWidgetUpdate(_root: WLRootType, _dt: number): boolean | void {
        // does nothing by default
    }

    /**
     * Called after a lazy-widgets update is done on this UI root. Can
     * optionally be implemented by child class.
     */
    protected afterWidgetUpdate(_root: WLRootType, _dt: number): void {
        // does nothing by default
    }

    /**
     * Called after the UI root of this component is ready. Can optionally be
     * implemented by child class.
     */
    protected onRootReady(_root: WLRootType): void {
        // does nothing by default
    }
}
