# Laravel Mix make file hash

Mix has querystring hashing by default which doesn't work too well with some caching systems.

Querystring hashing looks like this:<br>
```
(OLD) main.css?id=abcd1234
```

After mix has done it's thing, this script converts that querystring hashing to filename hashing:
```
(NEW) main.abcd1234.css
```

## Installation

```bash
npm i -D laravel-mix-make-file-hash
```

## Usage

This is not a Laravel mix plugin so use with `mix.then()` like this:

```js
if (mix.inProduction()) {

    // Allow versioning in production
    mix.version()

    // Run after mix finishes
    mix.then(() => {
            const laravelMixMakeFileHash = require("laravel-mix-make-file-hash")
            laravelMixMakeFileHash('web', 'web/mix-manifest.json')
    })
}
```

## Options

```js
laravelMixMakeFileHash(
    publicPath,
    manifestFilePath
)
```

## Under the hood

It'll first look at your manifest, then create a new file with the updated hash and then remove the old file.

Most of the code is from tomgrohl on this
[Laravel Mix issue on querystring hashing](https://github.com/JeffreyWay/laravel-mix/issues/1022#issuecomment-379168021)
