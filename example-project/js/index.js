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
import {WasdControlsComponent} from '@wonderlandengine/components';
import {CSMMouseLookComponent} from 'cursor-style-manager-wle';
import {CursorStyleManagerComponent} from 'cursor-style-manager-wle';
import {BasicXMLUIRootComponent} from 'lazy-widgets-wle';
import {LazyWidgetsInputGuardComponent} from 'lazy-widgets-wle';
import {VirtualKeyboardUIRootComponent} from 'lazy-widgets-wle';
import {TestUIRootComponent} from './TestUIRootComponent.js';
/* wle:auto-imports:end */
import {CursorTarget} from '@wonderlandengine/components';

import {loadRuntime} from '@wonderlandengine/api';

/* wle:auto-constants:start */
const Constants = {
    ProjectName: 'lazy-widgets-wle-example-project',
    RuntimeBaseName: 'WonderlandRuntime',
    WebXRRequiredFeatures: ['local',],
    WebXROptionalFeatures: ['local','hand-tracking','hit-test',],
};
const RuntimeOptions = {
    physx: false,
    loader: false,
    xrFramebufferScaleFactor: 1,
    xrOfferSession: {
        mode: 'auto',
        features: Constants.WebXRRequiredFeatures,
        optionalFeatures: Constants.WebXROptionalFeatures,
    },
    canvas: 'canvas',
};
/* wle:auto-constants:end */

const engine = await loadRuntime(Constants.RuntimeBaseName, RuntimeOptions);

engine.onSceneLoaded.once(() => {
    const el = document.getElementById('version');
    if (el) setTimeout(() => el.remove(), 2000);
});

/* WebXR setup. */

function requestSession(mode) {
    engine
        .requestXRSession(mode, Constants.WebXRRequiredFeatures, Constants.WebXROptionalFeatures)
        .catch((e) => console.error(e));
}

function setupButtonsXR() {
    /* Setup AR / VR buttons */
    const arButton = document.getElementById('ar-button');
    if (arButton) {
        arButton.dataset.supported = engine.arSupported;
        arButton.addEventListener('click', () => requestSession('immersive-ar'));
    }
    const vrButton = document.getElementById('vr-button');
    if (vrButton) {
        vrButton.dataset.supported = engine.vrSupported;
        vrButton.addEventListener('click', () => requestSession('immersive-vr'));
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('load', setupButtonsXR);
} else {
    setupButtonsXR();
}

/* wle:auto-register:start */
engine.registerComponent(Cursor);
engine.registerComponent(WasdControlsComponent);
engine.registerComponent(CSMMouseLookComponent);
engine.registerComponent(CursorStyleManagerComponent);
engine.registerComponent(BasicXMLUIRootComponent);
engine.registerComponent(LazyWidgetsInputGuardComponent);
engine.registerComponent(VirtualKeyboardUIRootComponent);
engine.registerComponent(TestUIRootComponent);
/* wle:auto-register:end */
engine.registerComponent(CursorTarget);

engine.scene.load(`${Constants.ProjectName}.bin`);

/* wle:auto-benchmark:start */
/* wle:auto-benchmark:end */
