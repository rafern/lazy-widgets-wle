import { Property } from '@wonderlandengine/api';
import { WLRoot, type WLRootProperties } from '../core/WLRoot.js';
import { NoDriverPropsBaseLazyWidgetsComponent } from './NoDriverPropsBaseLazyWidgetsComponent.js';

// TODO when dadouvic updates the api, use the @merge decorator on the class to
//      inherit properties from the parent component class

/**
 * The base component for a lazy-widgets UI.
 */
export abstract class BaseLazyWidgetsComponent<WLRootType extends WLRoot = WLRoot, WLRootPropertiesType extends WLRootProperties = WLRootProperties> extends NoDriverPropsBaseLazyWidgetsComponent<WLRootType, WLRootPropertiesType> {
    static override Properties = {
        ...NoDriverPropsBaseLazyWidgetsComponent.Properties,
        registerPointerDriver: Property.bool(WLRoot.defaultRegisterPointerDriver),
        registerKeyboardDriver: Property.bool(WLRoot.defaultRegisterKeyboardDriver),
    };

    /**
     * Register the default pointer driver to this root? If collisionGroupsMask
     * is zero, this is forced to false. true by default.
     */
    registerPointerDriver!: boolean;
    /** Register the default keyboard driver to this root? true by default. */
    registerKeyboardDriver!: boolean;

    protected override getRootProperties(): WLRootPropertiesType {
        return {
            ...super.getRootProperties(),
            registerPointerDriver: this.registerPointerDriver,
            registerKeyboardDriver: this.registerKeyboardDriver,
        } as WLRootPropertiesType;
    }
}
