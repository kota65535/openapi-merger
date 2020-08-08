// cf. https://github.com/OAI/OpenAPI-Specification/blob/master/schemas/v3.0/schema.json
//     https://github.com/OAI/OpenAPI-Specification/tree/master/versions
const REF_TYPES = {
  parameters: (path) => {
    return path.match(/parameters.\d+$/);
  },
  responses: (path) => {
    return path.match(/responses\.(default|\d{3})$/);
  },
  examples: (path) => {
    return path.match(/examples$/);
  },
  requestBody: (path) => {
    return path.match(/requestBody$/);
  },
  headers: (path) => {
    return path.match(/headers$/);
  },
  securitySchemes: (path) => {
    return path.match(/securitySchemes\.[a-zA-Z0-9.-_]+$/);
  },
  links: (path) => {
    return path.match(/links$/);
  },
  callbacks: (path) => {
    return path.match(/callbacks\.[a-zA-Z0-9.-_]+$/);
  },
  schemas: (path) => {
    return path.match(
      /(not|allOf|oneOf|anyOf|items|additionalProperties|schema|(properties|discriminator)\.[a-zA-Z0-9\.\-_]+)$/
    );
  },
  pathItems: (path) => {
    return path.match(/paths\.\/[^\.]*$/);
  },
};

const INCLUDABLE = new Set(["pathItems", "unknown"]);

function getRefType(path) {
  for (const [k, v] of Object.entries(REF_TYPES)) {
    if (v(path)) {
      return k;
    }
  }
  console.log(`unknown component type "${path}" : fallback to include`);
  return "unknown";
}

function shouldInclude(type) {
  return INCLUDABLE.has(type);
}

module.exports = {
  getRefType,
  shouldInclude,
};
