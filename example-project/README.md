# lazy-widgets-wle example project

Basic example project for how to use lazy-widgets in Wonderland Engine.

## Installation

This project is also used for continuous integration, and so it uses the parent
folder as the source for the `lazy-widgets-wle` package instead of installing it
from the NPM registry.

However, it uses a `preinstall` script that automatically installs the package
correctly, so you shouldn't have to do anything for the package to work (unless
you have the `npm install` on start option disabled in the editor; if so you
have to manually run `npm install`).
