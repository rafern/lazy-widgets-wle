/**
 * /!\ This file is auto-generated.
 *
 * This is the entry point of your standalone application.
 *
 * There are multiple tags used by the editor to inject code automatically:
 *     - `wle:auto-imports:start` and `wle:auto-imports:end`: The list of import statements
 *     - `wle:auto-register:start` and `wle:auto-register:end`: The list of component to register
 *     - `wle:auto-constants:start` and `wle:auto-constants:end`: The project's constants,
 *        such as the project's name, whether it should use the physx runtime, etc...
 *     - `wle:auto-benchmark:start` and `wle:auto-benchmark:end`: Append the benchmarking code
 */

/* wle:auto-imports:start */
import {Cursor} from '@wonderlandengine/components';
import {CanvasUIInputGuardComponent} from 'lazy-widgets-wle';
import {MouseLookComponent} from '@wonderlandengine/components';
import {TestUIRoot} from './test-ui-root.js';
import {VirtualKeyboardUIRootComponent} from 'lazy-widgets-wle';
import {WasdControlsComponent} from '@wonderlandengine/components';
/* wle:auto-imports:end */
// HACK need to manually import CursorTarget because Component Dependencies
//      aren't added yet
import {CursorTarget} from '@wonderlandengine/components';

import * as API from '@wonderlandengine/api'; // Deprecated: Backward compatibility.
import {loadRuntime} from '@wonderlandengine/api';

/* wle:auto-constants:start */
const ProjectName = 'lazy-widgets-wle-example-project';
const RuntimeBaseName = 'WonderlandRuntime';
const WithPhysX = false;
const WithLoader = false;
/* wle:auto-constants:end */

const engine = await loadRuntime(RuntimeBaseName, {
    physx: WithPhysX,
    loader: WithLoader
});

Object.assign(engine, API); // Deprecated: Backward compatibility.
window.WL = engine; // Deprecated: Backward compatibility.

engine.onSceneLoaded.add(() => {
    const el = document.getElementById('version');
    if(el) {
        setTimeout(() => el.remove(), 2000);
    }
});

const arButton = document.getElementById('ar-button');
if(arButton) {
    arButton.dataset.supported = engine.arSupported;
}

const vrButton = document.getElementById('vr-button');
if(vrButton) {
    vrButton.dataset.supported = engine.vrSupported;
}

/* wle:auto-register:start */
engine.registerComponent(Cursor);
engine.registerComponent(CanvasUIInputGuardComponent);
engine.registerComponent(MouseLookComponent);
engine.registerComponent(TestUIRoot);
engine.registerComponent(VirtualKeyboardUIRootComponent);
engine.registerComponent(WasdControlsComponent);
/* wle:auto-register:end */
engine.registerComponent(CursorTarget);

engine.scene.load(`${ProjectName}.bin`);

/* wle:auto-benchmark:start */
/* wle:auto-benchmark:end */
