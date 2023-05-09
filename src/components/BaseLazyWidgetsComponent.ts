import { Property } from '@wonderlandengine/api';
import { WLRoot } from '../core/WLRoot';
import { NoDriverPropsBaseLazyWidgetsComponent } from './NoDriverPropsBaseLazyWidgetsComponent';

import type { WLRootProperties } from '../core/WLRoot';

/**
 * The base component for a lazy-widgets UI.
 */
export abstract class BaseLazyWidgetsComponent<WLRootType extends WLRoot = WLRoot, WLRootPropertiesType extends WLRootProperties = WLRootProperties> extends NoDriverPropsBaseLazyWidgetsComponent<WLRootType, WLRootPropertiesType> {
    static override Properties = {
        ...NoDriverPropsBaseLazyWidgetsComponent.Properties,
        registerPointerDriver: Property.bool(true),
        registerKeyboardDriver: Property.bool(true),
    };

    /**
     * Register the default pointer driver to this root? If collisionGroup is
     * negative, this is forced to false. true by default.
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
