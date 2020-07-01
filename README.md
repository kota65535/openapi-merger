# openapi-merger

merge multiple OpenAPI files into a single file.  

## Features
- almost the same as [swagger-merger](https://github.com/WindomZ/swagger-merger)
- convert all remote refs into local refs, rather than simply replacing them by its content. 
  This is useful on code generation using [openapi-generator](https://github.com/OpenAPITools/openapi-generator), 
  because it prevents generating duplicate model classes.

