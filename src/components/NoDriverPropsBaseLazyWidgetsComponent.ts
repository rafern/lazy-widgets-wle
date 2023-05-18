import { Component, Property } from '@wonderlandengine/api';
import { CursorTarget } from '@wonderlandengine/components';
import { makeLWWLEErrMsg } from '../core/makeLWWLEErrMsg';
import { WLRoot } from '../core/WLRoot';

import type { Material, WonderlandEngine, Object3D } from '@wonderlandengine/api';
import type { Widget } from 'lazy-widgets';
import type { WLRootProperties } from '../core/WLRoot';

// TODO use decorators

/**
 * The base component for a lazy-widgets UI, with no editor properties for
 * toggling drivers. Useful for virtual keyboard UI roots, where drivers should
 * never be disabled
 */
export abstract class NoDriverPropsBaseLazyWidgetsComponent<WLRootType extends WLRoot = WLRoot, WLRootPropertiesType extends WLRootProperties = WLRootProperties> extends Component {
    static override Properties = {
        material: Property.material(),
        unitsPerPixel: Property.float(0.01),
        collisionGroup: Property.int(1),
        cloneMaterial: Property.bool(true),
        textureUniformName: Property.string(),
        cursorStyleManagerObject: Property.object(),
        cursorStyleManagerName: Property.string('cursor-style-manager'),
    };

    /** Material to apply the canvas texture to */
    material!: Material;
    /**
     * The amount of world units per canvas pixel. Determines the pixel density
     * of the mesh. 0.01 by default.
     */
    unitsPerPixel!: number;
    /**
     * The collision group that this root's collider will belong to. If
     * negative, collider and cursor-target will not be added. 1 by default.
     */
    collisionGroup!: number;
    /**
     * Should the material used for the Root be cloned? If false, then the
     * actual material will be used, which will lead to issues if the material
     * is also used elsewhere.
     */
    cloneMaterial!: boolean;
    /**
     * Which uniform name should be used for setting the material's texture? If
     * not passed, then the uniform name will be guessed from the pipeline name,
     * which will result in an error when an unknown pipeline is used.
     */
    textureUniformName!: string;
    /** Object with cursor style manager */
    cursorStyleManagerObject!: Object3D | null;
    /** Component name for cursor style manager */
    cursorStyleManagerName!: string;

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

    override update(dt: number) {
        if(this.guardRoot(this.root)) {
            const beforeUpdateRet = this.beforeWidgetUpdate(this.root, dt);

            if (beforeUpdateRet || beforeUpdateRet === undefined) {
                this.root.update();
                this.afterWidgetUpdate(this.root, dt);
            }
        }
    }

    override onActivate() {
        if(this.guardRoot(this.root)) {
            this.root.enabled = true;
        }
    }

    override onDeactivate() {
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
        return {
            unitsPerPixel: this.unitsPerPixel,
            collisionGroup: this.collisionGroup,
            cloneMaterial: this.cloneMaterial,
            textureUniformName: this.textureUniformName,
            cursorStyleManager: this.cursorStyleManagerObject?.getComponent(this.cursorStyleManagerName),
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
