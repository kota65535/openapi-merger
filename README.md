# openapi-merger

Yet another CLI tool for merging multiple OpenAPI files into a single file.

## Features
- Similar to [swagger-merger](https://github.com/WindomZ/swagger-merger)
- Convert all remote & URL refs into local refs
  - This is useful on code generation, because it helps [openapi-generator](https://github.com/OpenAPITools/openapi-generator)
    to output unique model classes without duplication.
- `$include` keyword: same as `$ref`, except it merges the object with sibling elements. (`$ref` ignores them)

## Usage

```sh
$ npm install -g openapi-merger
$ openapi-merger -i openapi.yaml -o out.yaml
```

## $include keyword

There are some patterns for $include usage.
- merge object into object
- merge object into array
- merge array into array

### merge object into object
- object.yml
```yaml
key1: val1
key2: val2
```
- main.yml
```yaml
map:
  $include: ./object.yml
  key3: val3
```
- results in:
```yaml
map:
  key1: val1
  key2: val2
  key3: val3
``` 

### merge object into array
- object.yml
```yaml
key1: val1
key2: val2
```
- main.yml
```yaml
array:
  - $include: ./object.yml
  - key3: val3
    key4: val4
```
- results in:
```yaml
map:
  - key1: val1
    key2: val2
  - key3: val3
    key4: val4
``` 

### merge array into array
- array.yml
```yaml
- val1
- val2
```
- main.yml
```yaml
array:
  - $include: ./array.yml
  - val3
```
- results in:
```yaml
array:
  - val1
  - val2
  - val3
``` 

