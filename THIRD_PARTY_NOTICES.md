# Third-Party Notices

IMGecko's extended encoder runtime is implemented with local plain JavaScript in this repository.

`src/vendor/gifenc.min.js` is a compatibility shim so both browser bundles can keep a stable script-loading order. Static GIF encoding is implemented in `src/shared/encoders/binary_encoders.js`; the shim does not contain third-party runtime code.
