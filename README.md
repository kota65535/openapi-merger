# openapi-merger

Yet another CLI tool for merging multiple OpenAPI files into a single file.

![build workflow](https://github.com/kota65535/openapi-merger/actions/workflows/build.yml/badge.svg)
[![NPM](https://nodei.co/npm/openapi-merger.png)](https://nodei.co/npm/openapi-merger/)

## Features
- Similar to [swagger-merger](https://github.com/WindomZ/swagger-merger)
- Convert all remote & URL refs into local refs
  - This is useful on code generation, because it helps [openapi-generator](https://github.com/OpenAPITools/openapi-generator)
    to output unique model classes without duplication.
- `$include` keyword: same as `$ref`, except it merges the object with sibling elements. (`$ref` ignores them)

## Usage

```sh
$ npm install -g openapi-merger
$ openapi-merger -i openapi.yaml -o merged.yaml
```

## $include keyword

openapi-merger introduces the special keyword `$include`.
It has similar syntax as `$ref`, which takes JSON reference as its value.

```yaml
$include: 'reference to content'
```

The biggest difference is that `$include` replaces itself directly by the referenced content, allowing to merge its sibling elements.


### Merge objects & arrays

If `$include` is used in an object and then referenced content is an object too, they are merged.

- main.yml
```yaml
object:
  $include: object.yml
  key3: val3
```

- object.yml
```yaml
key1: val1
key2: val2
```

- results in:
```yaml
object:
  key1: val1
  key2: val2
  key3: val3
``` 

Arrays go in the same manner.

- main.yml
```yaml
array:
  - $include: array.yml
  - val3
```

- array.yml
```yaml
- val1
- val2
```

- results in:
```yaml
array:
  - val1
  - val2
  - val3
``` 

If you want not to merge arrays, use `$include` in a nested array.

- main.yml
```yaml
array:
  - - $include: array.yml
  - val3
```

- array.yml
```yaml
- val1
- val2
```

- results in:
```yaml
array:
  - - val1
    - val2
  - val3
``` 

### Multiple $include at same place

`$include` can be used multiple times in the same place by appending `#` with some ID, avoiding key duplication.

```yaml
$include#foo: ./foo.yml
$include#bar: ./bar.yml
```


### Key modification & Filtering

`$include` is capable of modification and filtering of the keys of the referenced content.
This is useful when you want to aggregate multiple OpenAPI documents of backend services into one for API Gateway.

To utilize this function, a configuration file should be given by `-c` option.
The configuration file is like following:

```yaml
include:
  # 'foo' class, which add '/v1' prefix to each key
  foo:
    prefix: /v1
  # 'bar' class, which selects only keys matching to regex 
  # here excluding paths that begins 'internal'
  bar: 
    filter: ^(?!/internal).*
```

Use defined class as following:
- main.yml
```yaml
# using foo class
$include.foo: paths.yml 
# using bar class
$include.bar: paths.yml
```

- paths.yml
```yaml
/users:
  post:
    ...

/users/{id}:
  get:
    ...

/internal/pets:
  post:
    ...
```

- results in:
```yaml
# from $include.foo
/v1/users:
  post:
    ...

/v1/users/{id}:
  get:
    ...

/v1/internal/pets:
  post:
    ...

# from $include.bar
/users:
  post:
    ...

/users/{id}:
  get:
    ...
```

You can still use `#` notation to avoid key conflicts like below. 

```yaml
$include#a.foo: paths1.yml
$include#b.foo: paths2.yml
```
