const log = require("loglevel");

// cf. https://github.com/OAI/OpenAPI-Specification/blob/master/schemas/v3.0/schema.json
//     https://github.com/OAI/OpenAPI-Specification/tree/master/versions
const FIELD_PATTERN = "([a-zA-Z0-9\\-_]|[^\x01-\x7E\uFF61-\uFF9F])+";
const MAX_JSON_PATH_DEPTH = 100;

const REF_TYPES = {
  parameters: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#path-item-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#operation-object
    return path.match(`(parameters\\.${FIELD_PATTERN}|parameters\\.\\d+)$`);
  },
  responses: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#responses-object
    return path.match(`(responses\\.${FIELD_PATTERN}|responses\\.(default|\\d{3}))$`);
  },
  examples: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#parameter-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#media-type-object
    return path.match(`examples\\.${FIELD_PATTERN}$`);
  },
  requestBodies: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#operation-object
    return path.match(`(requestBodies\\.${FIELD_PATTERN}|requestBody)$`);
  },
  headers: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#encoding-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#response-object
    return path.match(`headers\\.${FIELD_PATTERN}$`);
  },
  securitySchemes: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    return path.match(`securitySchemes\\.${FIELD_PATTERN}$`);
  },
  links: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#response-object
    return path.match(`links\\.${FIELD_PATTERN}$`);
  },
  callbacks: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#operation-object
    return path.match(`callbacks\\.${FIELD_PATTERN}$`);
  },
  schemas: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#components-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#parameter-object
    //     https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#media-type-object
    return path.match(
      `(schema|items|additionalProperties|(schemas|properties|discriminator)\\.${FIELD_PATTERN}|(allOf|oneOf|anyOf)\\.\\d+)$`,
    );
  },
  pathItems: (path) => {
    // cf. https://github.com/OAI/OpenAPI-Specification/blob/main/versions/3.0.3.md#path-item-object
    return path.match(/paths\.\/[^.]*$/);
  },
};

const INCLUDABLE = new Set(["pathItems", "unknown"]);

function getRefType(path) {
  for (const [k, v] of Object.entries(REF_TYPES)) {
    if (v(path)) {
      return k;
    }
  }
  log.warn(`could not infer $ref type at "${path}". fallback to include.`);
  if (path.split(".").length > MAX_JSON_PATH_DEPTH) {
    throw new Error(`JSON path depth exceeds ${MAX_JSON_PATH_DEPTH}, aborting...`);
  }
  return "unknown";
}

function shouldInclude(type) {
  return INCLUDABLE.has(type);
}

module.exports = {
  getRefType,
  shouldInclude,
};
