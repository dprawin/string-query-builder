export type PipeTransform = (value: any, ...args: string[]) => any;

export interface QueryOptions {
  /** Custom pipes to extend or override built-in pipes */
  pipes?: Record<string, PipeTransform>;
}

// --- Internal Utilities & Extractors ---

/** Intelligently splits path and pipes while ignoring | inside brackets */
const extractPipes = (expr: string) => {
  let bracketDepth = 0;
  for (let i = 0; i < expr.length; i++) {
    if (expr[i] === "[") bracketDepth++;
    else if (expr[i] === "]") bracketDepth--;
    else if (expr[i] === "|" && bracketDepth === 0) {
      // PRESERVE trailing spaces: Only strip leading spaces from the pipe expression
      return {
        main: expr.slice(0, i).trim(),
        pipes: expr.slice(i + 1).replace(/^\s+/, ""),
      };
    }
  }
  return { main: expr.trim(), pipes: "" };
};

/** Safely extracts ternary operators ignoring strings and pipe arguments */
const splitTernarySafe = (expr: string) => {
  let inStr = false,
    quoteChar = "",
    depth = 0;
  let qIndex = -1,
    cIndex = -1;

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i];
    const prev = i > 0 ? expr[i - 1] : "";

    // Track if we are inside a string literal
    if ((char === "'" || char === '"' || char === "`") && prev !== "\\") {
      if (!inStr) {
        inStr = true;
        quoteChar = char;
      } else if (quoteChar === char) inStr = false;
    }

    if (!inStr) {
      if (char === "(" || char === "[" || char === "{") depth++;
      else if (char === ")" || char === "]" || char === "}") depth--;
      else if (char === "?" && depth === 0 && qIndex === -1) qIndex = i;
      else if (char === ":" && depth === 0 && qIndex !== -1 && cIndex === -1) {
        // Skip colons that are part of pipe arguments
        const segment = expr.slice(qIndex + 1, i);
        const nextStr = expr.slice(i + 1).trim();
        const nextChar = nextStr ? nextStr[0] : "";
        if (segment.includes("|") && nextChar !== "'" && nextChar !== '"')
          continue;
        cIndex = i;
      }
    }
  }
  return { qIndex, cIndex };
};

// --- Core Evaluators ---

const getProperty = (
  path: string,
  context: any,
  availablePipes: Record<string, PipeTransform>,
): any => {
  if (!path || path === "this") return context;
  const parts = path.split(/\.(?![^\[]*\])/);
  let current = context;

  for (const part of parts) {
    if (current == null) return undefined;

    const arrayMatch = part.match(/^(\w+)\[(.+)\]$/);
    if (arrayMatch) {
      const [, name, indexExpr] = arrayMatch;
      const array = current[name];
      if (!Array.isArray(array)) return undefined;

      if (/^\d+$/.test(indexExpr)) {
        current = array[parseInt(indexExpr, 10)];
      } else {
        const condParts = indexExpr.split("&&").map((p) => p.trim());
        const targetPropRaw = condParts.pop() || "";

        // Extract pipes if they are inside the array bracket condition
        const { main: targetProp, pipes: innerPipes } =
          extractPipes(targetPropRaw);

        let foundItem;
        if (/^\d+$/.test(condParts[0]) && condParts.length === 1) {
          foundItem = array[parseInt(condParts[0], 10)];
        } else {
          foundItem = array.find((item) => {
            return condParts.every((cond) => {
              const match = cond.match(
                /([\w\.\[\]]+)\s*(==|!=|>=|<=|>|<)\s*(.+)/,
              );

              // Fallback to truthiness check if no operator is found (e.g., isActive && ...)
              if (!match) {
                const val = getProperty(cond.trim(), item, availablePipes);
                return !!val && val !== "" && val !== 0;
              }

              const [_, key, op, rawVal] = match;
              const itemVal = getProperty(key, item, availablePipes);
              const compareVal = rawVal.replace(/^['"]|['"]$/g, "");

              if (op === "==") return String(itemVal) === compareVal;
              if (op === "!=") return String(itemVal) !== compareVal;
              if (op === ">=") return Number(itemVal) >= Number(compareVal);
              if (op === "<=") return Number(itemVal) <= Number(compareVal);
              if (op === ">") return Number(itemVal) > Number(compareVal);
              if (op === "<") return Number(itemVal) < Number(compareVal);
              return false;
            });
          });
        }

        if (!foundItem) {
          current = undefined;
        } else if (targetProp.startsWith("'") && targetProp.endsWith("'")) {
          // Handle string literal return with potential inner object interpolation
          const literal = targetProp.slice(1, -1);
          current = literal.replace(/\$\{object\.([^}]+)\}/g, (_, p) => {
            const val = getProperty(p, foundItem, availablePipes);
            return val != null ? String(val) : "";
          });
        } else {
          current = getProperty(targetProp, foundItem, availablePipes);
        }

        // Apply inner-bracket pipes
        if (innerPipes && current !== undefined) {
          current = applyPipes(current, innerPipes, availablePipes);
        }
      }
    } else {
      current = current[part];
      // Auto-parse JSON strings safely
      if (
        typeof current === "string" &&
        (current.startsWith("{") || current.startsWith("["))
      ) {
        try {
          current = JSON.parse(current);
        } catch (e) {}
      }
    }
  }
  return current;
};

const applyPipes = (
  value: any,
  pipeExpression: string,
  availablePipes: Record<string, PipeTransform>,
): any => {
  if (!pipeExpression) return value;

  const pipeSegments = pipeExpression.split("|");
  return pipeSegments.reduce((acc, pipeStr, idx) => {
    const firstColonIdx = pipeStr.indexOf(":");
    let name = pipeStr.trim();
    let params: string[] = [];

    if (firstColonIdx !== -1) {
      name = pipeStr.slice(0, firstColonIdx).trim();
      let rawParams = pipeStr.slice(firstColonIdx + 1);

      // If there's another pipe chained after this one, trim the trailing spaces
      if (idx < pipeSegments.length - 1) {
        rawParams = rawParams.trimEnd();
      }

      if (name === "formatDate") {
        params = [rawParams.trim()];
      } else if (name === "formatDuration" || name === "mapJoin") {
        const splitIdx = rawParams.indexOf(":");
        params =
          splitIdx === -1
            ? [rawParams.trim()]
            : // Preserve exact spacing on the second argument (the separator)
              [
                rawParams.slice(0, splitIdx).trim(),
                rawParams.slice(splitIdx + 1),
              ];
      } else {
        params = rawParams.split(":").map((p) => p.trim());
      }
    }

    const transform = availablePipes[name];
    if (!transform) throw new Error(`Pipe "${name}" is not registered.`);
    return transform(acc, ...params);
  }, value);
};

const evaluateCondition = (
  condition: string,
  context: any,
  availablePipes: Record<string, PipeTransform>,
) => {
  const match = condition.match(/([\w\.\[\]]+)\s*(==|!=|>=|<=|>|<)\s*(.+)/);
  if (match) {
    const [_, path, op, rawVal] = match;
    const val = getProperty(path.trim(), context, availablePipes);
    const compareVal = rawVal.replace(/^['"]|['"]$/g, "");

    if (op === "==") return String(val) === compareVal;
    if (op === "!=") return String(val) !== compareVal;
    if (op === ">=") return Number(val) >= Number(compareVal);
    if (op === "<=") return Number(val) <= Number(compareVal);
    if (op === ">") return Number(val) > Number(compareVal);
    if (op === "<") return Number(val) < Number(compareVal);
  }
  // Fallback to truthiness
  const truthyVal = getProperty(condition.trim(), context, availablePipes);
  return !!truthyVal && truthyVal !== "" && truthyVal !== 0;
};

const evaluateTemplate = (
  template: string,
  data: any,
  options: QueryOptions,
): string => {
  const content = template.slice(1, -1);
  return content.replace(/\${(.*?)}/g, (_, innerQuery) => {
    const result = query(`\${${innerQuery}}`, data, options);
    return result !== undefined && result !== null ? String(result) : "";
  });
};

// --- Built-in Pipes (Stateless Dictionary) ---

const BUILT_IN_PIPES: Record<string, PipeTransform> = {
  uppercase: (val: any) => val?.toString().toUpperCase(),
  lowercase: (val: any) => val?.toString().toLowerCase(),
  slice: (val: any, start = "0", end?: string) => {
    if (val == null) return val;
    return Array.isArray(val) || typeof val === "string"
      ? val.slice(parseInt(start, 10), end ? parseInt(end, 10) : undefined)
      : val;
  },
  number: (val: any, decimals: string | null = null) => {
    if (val == null || isNaN(val)) return val;
    const num = parseFloat(val);
    return decimals != null ? num.toFixed(parseInt(decimals, 10)) : num;
  },
  truncate: (val: any, length = "50") => {
    if (val == null) return val;
    const str = String(val);
    const max = parseInt(length, 10);
    if (isNaN(max) || max < 0) return str;
    if (str.length <= max) return str;
    return max < 3 ? str.slice(0, max) : str.slice(0, max - 3) + "...";
  },
  mapJoin: (val: any, property = "", separator = ", ") => {
    if (val == null) return val;
    if (!Array.isArray(val)) throw new Error("mapJoin pipe requires an array");
    const cleanSep = separator.replace(/^['"]|['"]$/g, "");

    return val
      .map((item) => {
        if (item == null) return null;
        if (property && typeof item === "object") {
          return getProperty(property.trim(), item, BUILT_IN_PIPES);
        }
        return item;
      })
      .filter((v) => v != null && v !== "")
      .join(cleanSep);
  },
  currency: (val: any, symbol = "$", decimals = "2") => {
    if (val == null) return val;
    const num = parseFloat(val);
    return isNaN(num) ? val : `${symbol}${num.toFixed(parseInt(decimals, 10))}`;
  },
  formatDate: (val: any, format = "YYYY-MM-DD HH:mm:ss") => {
    if (!val) return val;
    let d: Date;

    if (typeof val === "number") {
      d = new Date(val < 946684800000 ? val * 1000 : val);
    } else {
      d = new Date(val);
      if (isNaN(d.getTime()) && typeof val === "string") {
        const match = val.match(
          /^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}):(\d{2}))?$/,
        );
        if (match) {
          const [, y, m, day, h = 0, min = 0, s = 0] = match.map(Number);
          d = new Date(y, m - 1, day, h, min, s);
        }
      }
    }

    if (isNaN(d.getTime())) return val;

    const pad = (n: number) => String(n).padStart(2, "0");
    const monthAbbr = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const formats: Record<string, () => string> = {
      "YYYY-MM-DD": () =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      "hh:mm:ss": () =>
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      "HH:mm:ss": () =>
        `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      "YYYY-MM-DD HH:mm:ss": () =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      "DD MMM YYYY": () =>
        `${pad(d.getDate())} ${monthAbbr[d.getMonth()]} ${d.getFullYear()}`,
      "DD MMMM YYYY": () =>
        `${pad(d.getDate())} ${monthNames[d.getMonth()]}, ${d.getFullYear()}`,
      "MMMM-YYYY": () => `${monthNames[d.getMonth()]}-${d.getFullYear()}`,
      "MM-YYYY": () => `${pad(d.getMonth() + 1)}-${d.getFullYear()}`,
      "MM/YYYY": () => `${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    };
    return formats[format] ? formats[format]() : String(val);
  },
  formatDuration: (val: any, unit = "seconds", format = "HH:mm:ss") => {
    if (val == null || isNaN(val)) return val;
    let totalSeconds = parseFloat(val);

    if (unit.toLowerCase().startsWith("min")) totalSeconds *= 60;
    if (unit.toLowerCase().startsWith("hour") || unit.toLowerCase() === "h")
      totalSeconds *= 3600;

    const d = Math.floor(totalSeconds / 86400);
    const h = Math.floor((totalSeconds % 86400) / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = Math.floor(totalSeconds % 60);

    const pad = (n: number, len = 2) => String(n).padStart(len, "0");

    if (format === "HH:mm:ss")
      return `${pad(Math.min(h + d * 24, 99))}:${pad(m)}:${pad(s)}`;
    if (format === "HHH:mm:ss") {
      const totalHours = h + d * 24;
      return `${pad(totalHours, totalHours >= 100 ? 3 : 2)}:${pad(m)}:${pad(s)}`;
    }
    if (format === "DD:HHH:mm:ss")
      return `${pad(d)}:${pad(h, 3)}:${pad(m)}:${pad(s)}`;
    return String(val);
  },
};

// --- Public Package API ---

/**
 * Evaluates a template string with embedded queries against a data object.
 * Supports array conditionals, nested properties, pipes, and ternaries.
 * * @param queryString - The query string (e.g., "${items[type == 'TIR' && value | uppercase]}")
 * @param data - The data object to query against
 * @param options - Optional configuration (custom pipes)
 * @returns The evaluated result
 */
export const query = (
  queryString: string,
  data: Record<string, any> = {},
  options: QueryOptions = {},
): any => {
  const mergedOptions: QueryOptions = {
    ...options,
    pipes: { ...BUILT_IN_PIPES, ...(options.pipes || {}) },
  };
  const availablePipes = mergedOptions.pipes!;

  if (!queryString.startsWith("${") || !queryString.endsWith("}"))
    return queryString;

  // Keep a raw version to preserve trailing spaces for pipes
  const innerRaw = queryString.slice(2, -1);
  const inner = innerRaw.trim();

  if (inner.startsWith("`") && inner.endsWith("`")) {
    return evaluateTemplate(inner, data, mergedOptions);
  }

  if (inner.includes("?")) {
    const { qIndex, cIndex } = splitTernarySafe(inner);
    if (qIndex !== -1 && cIndex !== -1) {
      const condition = inner.slice(0, qIndex).trim();
      const isTrue = evaluateCondition(condition, data, availablePipes);
      const selected = (
        isTrue ? inner.slice(qIndex + 1, cIndex) : inner.slice(cIndex + 1)
      ).trim();

      if (selected.startsWith("${") || selected.startsWith("`")) {
        return query(
          selected.startsWith("`") ? `\${${selected}}` : selected,
          data,
          mergedOptions,
        );
      }
      if (
        (selected.startsWith("'") && selected.endsWith("'")) ||
        (selected.startsWith('"') && selected.endsWith('"'))
      ) {
        return selected.slice(1, -1);
      }

      const { main: path, pipes: pipeExpr } = extractPipes(selected);
      return applyPipes(
        getProperty(path, data, availablePipes),
        pipeExpr,
        availablePipes,
      );
    }
  }

  if (inner.endsWith(".length")) {
    const val = getProperty(inner.replace(".length", ""), data, availablePipes);
    return Array.isArray(val) ? val.length : 0;
  }

  // Use innerRaw here so the trailing space is passed to extractPipes
  const { main: path, pipes: pipeExpr } = extractPipes(innerRaw);
  return applyPipes(
    getProperty(path, data, availablePipes),
    pipeExpr,
    availablePipes,
  );
};
