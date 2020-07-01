# openapi-merger

merge multiple OpenAPI files into a single file.  

## Features
- almost the same as [swagger-merger](https://github.com/WindomZ/swagger-merger)
- convert all remote refs into local refs, rather than simply replacing them by its content. 
  This is useful on code generation using [openapi-generator](https://github.com/OpenAPITools/openapi-generator), 
  because it prevents generating duplicate model classes.

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

