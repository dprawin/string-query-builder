/**
 * Parse and execute a query
 * @param {string} query - Query string in format ${path[condition && property]} or ${path.length}
 * @returns {*} - The result of the query
 */
export const query = <T = any>(query: string, data: any): T | null => {
  // Extract the inner query from ${...}, handling nested ${} patterns
  const inner = extractOuterQuery(query);

  // Check if it's a template literal (backtick string)
  if (inner.startsWith("`") && inner.endsWith("`")) {
    return evaluateTemplateLiteral(inner, data) as T;
  }

  return null;
  // Check if it's a ternary operator
  // if (inner.includes("?")) {
  //   return this.evaluateTernary(inner);
  // }

  // Check if it's a length query
  // if (inner.endsWith(".length")) {
  //   return this.getLength(inner);
  // }

  // Check if it's a find operation with conditions (e.g., items[type == 'TIR' && value])
  // vs simple array index access (e.g., items[0] or properties.items[0].field)
  //   if (inner.includes("[")) {
  //     // Check if it's a simple numeric array index (e.g., [0], [1], [123])
  //     // vs a conditional find (e.g., [type == 'TIR'], [condition && property])
  //     const bracketMatch = inner.match(/\[([^\]]+)\]/);
  //     if (bracketMatch) {
  //       const bracketContent = bracketMatch[1];
  //       // If bracket contains only a number, it's a simple array index - use getProperty
  //       // Otherwise, it's a conditional find - use findWithCondition
  //       if (/^\d+$/.test(bracketContent.trim())) {
  //         // Simple array index access, use getProperty
  //         const { property, pipes } = parsePropertyWithPipes(inner);
  //         let result = getProperty(property, data);
  //         // if (pipes) {
  //         //   result = this.applyPipes(result, pipes);
  //         // }
  //         return result;
  //       } else {
  //         // Conditional find operation
  //         return findWithCondition(inner, data);
  //       }
  //     }
  //   }

  // // Simple property access (may include pipes)
  // const { property, pipes } = this.parsePropertyWithPipes(inner);
  // let result = this.getProperty(property);

  // // Apply pipes if any
  // if (pipes) {
  //   result = this.applyPipes(result, pipes);
  // }

  // return result;
};

function extractOuterQuery(query: string) {
  if (!query.startsWith("${")) {
    throw new Error("Invalid query format. Expected ${...}");
  }

  let depth = 1; // Start at depth 1 since we're inside the outer ${}
  let end = query.length;

  // Find the matching closing brace for the outer ${}
  for (let i = 2; i < query.length; i++) {
    if (i > 0 && query[i - 1] === "$" && query[i] === "{") {
      depth++;
    } else if (query[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (depth !== 0) {
    throw new Error("Invalid query format. Unmatched braces.");
  }

  return query.slice(2, end); // Skip "${" and return up to matching "}"
}

function evaluateTemplateLiteral(template: string, data: any) {
  // Remove outer backticks
  const content = template.slice(1, -1);
  let result = "";
  let i = 0;

  while (i < content.length) {
    if (
      content[i] === "$" &&
      i + 1 < content.length &&
      content[i + 1] === "{"
    ) {
      // Found ${...}, extract and evaluate
      let depth = 1;
      let j = i + 2;
      while (j < content.length && depth > 0) {
        if (
          content[j] === "$" &&
          j + 1 < content.length &&
          content[j + 1] === "{"
        ) {
          depth++;
          j += 2;
        } else if (content[j] === "}") {
          depth--;
          if (depth === 0) {
            break;
          }
          j++;
        } else {
          j++;
        }
      }

      const innerQuery = content.slice(i + 2, j);
      let queryResult;

      // Try to evaluate as a full query first (handles all cases including array indices, pipes, etc.)
      try {
        queryResult = query(`\${${innerQuery}}`, data);
      } catch (e) {
        // If query evaluation fails, try as a property reference (including array indices)
        // Match property paths like "property", "property.sub", "property[0]", "property[0].sub"
        if (/^[a-zA-Z_][a-zA-Z0-9_.\[\]]*$/.test(innerQuery)) {
          queryResult = getProperty(innerQuery, data);
        } else {
          queryResult = undefined;
        }
      }

      result +=
        queryResult !== null && queryResult !== undefined
          ? String(queryResult)
          : "";
      i = j + 1;
    } else {
      result += content[i];
      i++;
    }
  }

  return result;
}

/**
 * Get property value from data using dot notation
 * @param {string} path - Property path like "items" or "id" or "items[0].type"
 * @returns {*} - Property value
 */
function getProperty(path: string, data: any) {
  // Split by '.' but handle array indices like items[0]
  const parts = [];
  let currentPart = "";
  let bracketDepth = 0;

  for (let i = 0; i < path.length; i++) {
    const char = path[i];
    if (char === "[") {
      bracketDepth++;
      currentPart += char;
    } else if (char === "]") {
      bracketDepth--;
      currentPart += char;
    } else if (char === "." && bracketDepth === 0) {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = "";
      }
    } else {
      currentPart += char;
    }
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  let current = data;
  let parentObject = data;
  let lastPartName = null;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Check if part contains array index like "items[0]"
    const arrayIndexMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayIndexMatch) {
      const arrayName = arrayIndexMatch[1];
      const index = parseInt(arrayIndexMatch[2], 10);
      parentObject = current;
      lastPartName = arrayName;
      current = current[arrayName];

      // Auto-parse stringified JSON if it's a string
      if (typeof current === "string") {
        try {
          const parsed = JSON.parse(current);
          // Cache the parsed value back to the data object
          parentObject[arrayName] = parsed;
          current = parsed;
        } catch (e) {
          // Not valid JSON, continue with original string
        }
      }

      if (Array.isArray(current) && index >= 0 && index < current.length) {
        current = current[index];
      } else {
        return undefined;
      }
    } else {
      parentObject = current;
      lastPartName = part;
      current = current[part];

      // Auto-parse stringified JSON if it's a string
      if (typeof current === "string") {
        try {
          const parsed = JSON.parse(current);
          // Cache the parsed value back to the data object
          parentObject[part] = parsed;
          current = parsed;
        } catch (e) {
          // Not valid JSON, continue with original string
        }
      }
    }
  }

  return current;
}

/**
 * Parse property key to extract property name and pipe expression
 * @param {string} propertyKey - Property key like "value" or "value | formatDate:hh:mm:ss"
 * @returns {object} - {property: string, pipes: string|null}
 */
function parsePropertyWithPipes(propertyKey: string) {
  // Check if it's a string literal
  if (propertyKey.startsWith("'") && propertyKey.endsWith("'")) {
    return { property: propertyKey, pipes: null };
  }

  // Check if it contains pipes
  if (propertyKey.includes("|")) {
    const pipeIndex = propertyKey.indexOf("|");
    const property = propertyKey.slice(0, pipeIndex).trim();
    const pipes = propertyKey.slice(pipeIndex + 1).trim();
    return { property, pipes };
  }

  return { property: propertyKey, pipes: null };
}

// function /**
//  * Find item in array with conditions and return property
//  * @param {string} query - Query like "items[type == 'TIR' && value]" or "items[1 && id]"
//  * @returns {*} - Property value or undefined
//  */
// findWithCondition(query: string, data: any) {
//   const bracketIdx = query.indexOf("[");
//   const collectionPath = query.slice(0, bracketIdx);
//   const conditionPart = query.slice(bracketIdx + 1, query.length - 1); // Remove trailing ']'

//   // Get the array
//   const array = getProperty(collectionPath, data);
//   if (!Array.isArray(array)) {
//     throw new Error(`Property "${collectionPath}" is not an array`);
//   }

//   // Split conditions and property
//   const parts = conditionPart.split("&&").map((p) => p.trim());
//   const propertyKey = parts[parts.length - 1];
//   const firstPart = parts[0];

//   // Check if first part is a numeric index (e.g., "1", "0", "2")
//   const indexMatch = firstPart.match(/^\d+$/);
//   if (indexMatch && parts.length === 2) {
//     // This is an array index access: items[1 && id]
//     const index = parseInt(firstPart, 10);
//     if (index < 0 || index >= array.length) {
//       return undefined;
//     }
//     const item = array[index];

//     // Return property value or string if property is a string literal
//     if (propertyKey.startsWith("'") && propertyKey.endsWith("'")) {
//       const stringLiteral = propertyKey.slice(1, -1); // Remove quotes
//       // Interpolate ${...} patterns in the string
//       return interpolateString(stringLiteral, item);
//     }

//     // Parse property and pipes
//     const { property, pipes } = parsePropertyWithPipes(propertyKey);
//     let result = item[property];

//     // Apply pipes if any
//     //   if (pipes) {
//     //     result = this.applyPipes(result, pipes);
//     //   }

//     return result;
//   }

//   // Otherwise, treat as conditions
//   const conditions = parts.slice(0, parts.length - 1);

//   // Parse all conditions
//   const parsedConditions = conditions.map((cond) => parseCondition(cond, data));

//   // Find the first item that matches all conditions
//   const item = array.find((it) =>
//     parsedConditions.every((condition) => evaluateCondition(it, condition)),
//   );

//   if (!item) {
//     return undefined;
//   }

//   // Return property value or string if property is a string literal
//   if (propertyKey.startsWith("'") && propertyKey.endsWith("'")) {
//     const stringLiteral = propertyKey.slice(1, -1); // Remove quotes
//     // Interpolate ${...} patterns in the string
//     return this.interpolateString(stringLiteral, item);
//   }

//   // Parse property and pipes
//   const { property, pipes } = this.parsePropertyWithPipes(propertyKey);
//   let result = item[property];

//   // Apply pipes if any
//   if (pipes) {
//     result = this.applyPipes(result, pipes);
//   }

//   return result;
// }
