# openapi-merger

Yet another CLI tool for merging multiple OpenAPI files into a single file.

## Features
- Similar to [swagger-merger](https://github.com/WindomZ/swagger-merger)
- Convert all remote & URL refs into local refs
  - This is useful on code generation, because it helps [openapi-generator](https://github.com/OpenAPITools/openapi-generator)
    to output unique model classes without duplication.
- `$include` keyword: same as `$ref`, except it merges the object with sibling elements. (`$ref` ignores them)


## Prerequisites

- This tool assumes following directory structure, 
  that reflects the structure of [Components section](https://swagger.io/docs/specification/components/#structure) and
  all definitions (schema, parameter, etc) are separated into each file. 
- See 'example' directory for more detail.

```
.
├── components
│   ├── parameters
│   │   └── Limit.yaml
│   └── schemas
│       ├── Error.yaml
│       ├── Pet.yaml
│       └── Pets.yaml
└── openapi.yaml
```

## Usage

```sh
$ npm install -g openapi-merger
$ openapi-merger -i openapi.yaml -o out.yaml
```

