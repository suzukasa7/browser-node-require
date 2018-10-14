# browser-node-require
Load the module of Node.js from the browser

__!!! CAUTION !!!__

__Do not use this module in a production environment.
This is written for DEVELOPMENT.__

## Usage
    <script src="***/node_modules/browser-node-require/lib/index.js"></script>
This module defines a global function `require`, which can be handled in the same way as `require` of Node.js.

## Other API

### require.clearResolveCache()
Clear the cache of `require.resolve` recorded in session storage.

### require.hardRefresh(_includeNode_ = false)
Reload all modules and refresh the page.
_includeNode_ defines whether to reload the module under node_modules directory.