# lazy-widgets-wle

[Wonderland Engine](https://wonderlandengine.com/) integration for the
[lazy-widgets](https://github.com/rafern/lazy-widgets) Typescript UI library.

A reboot of the
[@rafern/canvas-ui-wl](https://www.npmjs.com/package/@rafern/canvas-ui-wl)
library.

## Installation and setup

1. Install the `lazy-widgets` NPM package: `npm install --save-dev lazy-widgets`
2. Install this NPM package: `npm install --save-dev lazy-widgets-wle`
3. Import needed classes from `lazy-widgets` and `lazy-widgets-wle` in your code
4. Create a new component for your UI root ([see examples section](#Examples))
5. Set the material to use for your UI root component to a textured material. If you want a semi-transparent background, create a new pipeline with alpha blending enabled

Note that there is no API in Wonderland Engine to get information about a
pipeline or shader. This means that there is no way for this library to know
which field should be set for a material's texture (is it `diffuseTexture` or
`flatTexture`, or another field name?). Because of this, this library tries to
guess which field should be set by looking at the name of the shader. Only the
following names are supported at the moment:
- `Flat Opaque Textured`
- `Flat Transparent Textured`
- `Phong Opaque Textured`

## Documentation

Documentation can be generated locally with the command `npm run docs`. Output
will be in a new `docs` folder. The documentation is also served on
[Github Pages](https://rafern.github.io/lazy-widgets-wle).

Documentation for `lazy-widgets` is available in the
[lazy-widgets Github Pages](https://rafern.github.io/lazy-widgets).

## Example

An example project can be found in the `example-project` folder, which is also
served on
[Github Pages](https://rafern.github.io/lazy-widgets-wle/example-project).

## Miscellaneous

A component which disables a component of 2 given objects if the keyboard and/or
mouse are in use in a UI root is also provided. The component is named
`lazy-widgets-input-guard`.

## Special thanks

Special thanks to Playko ([website](https://www.playko.com/),
[github](https://github.com/playkostudios)) where this project started and is
currently being developed at, and to the Wonderland Engine developers
([website](https://wonderlandengine.com/)).

## License

This project is licensed under the MIT license (see the LICENSE file)

This project uses the following open-source projects:
- [@typescript-eslint/eslint-plugin](https://github.com/typescript-eslint/typescript-eslint) licensed under the MIT license
- [@typescript-eslint/parser](https://github.com/typescript-eslint/typescript-eslint) licensed under the BSD 2-Clause license
- [@wonderlandengine/api](https://www.npmjs.com/package/@wonderlandengine/api) licensed under the MIT license
- [@wonderlandengine/components](https://www.npmjs.com/package/@wonderlandengine/components) licensed under the MIT license
- [esbuild](https://github.com/evanw/esbuild) licensed under the MIT license
- [eslint](https://github.com/eslint/eslint) licensed under the MIT license
- [eslint-plugin-tsdoc](https://github.com/microsoft/tsdoc) licensed under the MIT license
- [gl-matrix](https://github.com/toji/gl-matrix) licensed under the MIT license
- [lazy-widgets](https://github.com/rafern/lazy-widgets) licensed under the MIT license
- [rimraf](https://github.com/isaacs/rimraf) licensed under the ISC license
- [typedoc](https://github.com/TypeStrong/TypeDoc) licensed under the Apache 2.0 license
- [typedoc-plugin-external-resolver](https://github.com/rafern/typedoc-plugin-external-resolver) licensed under the MIT license
- [typescript](https://github.com/Microsoft/TypeScript) licensed under the Apache 2.0 license
- [tslib](https://github.com/Microsoft/tslib) licensed under the BSD Zero Clause License