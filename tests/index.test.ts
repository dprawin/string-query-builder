import { describe, it, expect } from "vitest";
import { query } from "../src/index";

const mockData = {
  id: "WA01",
  number: -357,
  score: 85.5678,
  description: "This is a very long string that needs to be truncated.",
  user: { name: "John Doe", age: 30, isActive: true, createdAt: 1705332645 },
  items: [
    {
      id: "T01",
      type: "TOR",
      value: "T00162",
      count: 5,
      price: 99.99,
      duration: 3905,
      isFlagged: true,
    },
    {
      id: "T02",
      type: "TIR",
      value: "T00345",
      count: 10,
      price: 149.5,
      duration: 125,
      isFlagged: false,
    },
    {
      id: "T03",
      type: "THW",
      value: "T00697",
      count: 3,
      time: "2024-01-15 12:00:00",
      price: 79.25,
    },
  ],
};

describe("Functional Query Builder", () => {
  describe("1. Basic Property Access", () => {
    it("should retrieve root and nested properties", () => {
      expect(query("${id}", mockData)).toBe("WA01");
      expect(query("${user.name}", mockData)).toBe("John Doe");
      expect(query("${invalidProp}", mockData)).toBeUndefined();
    });
  });

  describe("2. Array Operations & Conditionals", () => {
    it("should get array length and indices", () => {
      expect(query("${items.length}", mockData)).toBe(3);
      expect(query("${items[0].type}", mockData)).toBe("TOR");
    });

    it("should find item with ==, !=, <, > conditions", () => {
      expect(query("${items[type == 'TIR' && value]}", mockData)).toBe(
        "T00345",
      );
      expect(query("${items[type != 'TIR' && id]}", mockData)).toBe("T01");
      expect(query("${items[count < 5 && value]}", mockData)).toBe("T00697");
      expect(query("${items[count > 5 && type]}", mockData)).toBe("TIR");
    });

    it("should find item using a truthy boolean condition", () => {
      expect(query("${items[isFlagged && id]}", mockData)).toBe("T01");
    });

    it("should handle inner-bracket pipes", () => {
      expect(
        query("${items[type == 'TIR' && type | lowercase]}", mockData),
      ).toBe("tir");
    });
  });

  describe("3. Template Literals & Ternary Operators", () => {
    it("should evaluate ternary operators", () => {
      expect(query("${number > 0 ? 'positive' : 'negative'}", mockData)).toBe(
        "negative",
      );
      expect(query("${user.age >= 30 ? 'adult' : 'minor'}", mockData)).toBe(
        "adult",
      );
    });

    it("should evaluate ternary operators safely ignoring pipes inside branches", () => {
      expect(
        query(
          "${user.isActive ? user.createdAt | formatDate:YYYY-MM-DD : 'N/A'}",
          mockData,
        ),
      ).toBe("2024-01-15");
    });

    it("should evaluate backtick template literals", () => {
      expect(
        query("${`User ${user.name} has ${items.length} items.`}", mockData),
      ).toBe("User John Doe has 3 items.");
    });
  });

  describe("4. Built-in Pipes", () => {
    it("should apply uppercase, lowercase, and slice pipes", () => {
      expect(query("${user.name | uppercase}", mockData)).toBe("JOHN DOE");
      expect(query("${user.name | lowercase}", mockData)).toBe("john doe");
      expect(query("${user.name | slice:0:4}", mockData)).toBe("John");
    });

    it("should apply number and truncate pipes", () => {
      expect(query("${score | number:2}", mockData)).toBe("85.57");
      expect(query("${description | truncate:15}", mockData)).toBe(
        "This is a ve...",
      );
    });

    it("should apply mapJoin pipe on arrays", () => {
      expect(query("${items | mapJoin:type: - }", mockData)).toBe(
        "TOR - TIR - THW",
      );
    });

    it("should apply currency pipe", () => {
      expect(
        query("${items[type == 'TIR' && price | currency:€:1]}", mockData),
      ).toBe("€149.5");
    });

    it("should correctly format Unix timestamps and Durations", () => {
      expect(query("${user.createdAt | formatDate:YYYY-MM-DD}", mockData)).toBe(
        "2024-01-15",
      );
      expect(
        query(
          "${items[type == 'TOR' && duration | formatDuration:seconds:HH:mm:ss]}",
          mockData,
        ),
      ).toBe("01:05:05");
    });
  });

  describe("5. Error Handling & Extensibility", () => {
    it("should throw an error if an unregistered pipe is used", () => {
      expect(() =>
        query("${user.name | nonexistentPipe}", mockData),
      ).toThrowError('Pipe "nonexistentPipe" is not registered.');
    });

    it("should accept custom pipes via options", () => {
      const customOptions = {
        pipes: { reverse: (val: string) => val.split("").reverse().join("") },
      };
      expect(query("${user.name | reverse}", mockData, customOptions)).toBe(
        "eoD nhoJ",
      );
    });
  });

  describe("6. Coverage Gap Fillers (Edge Cases & Fallbacks)", () => {
    const edgeData = {
      empty: null,
      notANumber: "abc",
      badDate: "invalid-date-string",
      shortStr: "Hi",
      longStr: "Hello World",
      dateObj: new Date("2024-02-15T14:30:45Z").getTime(),
      jsonProp: '{"nested": "success"}',
      badJsonProp: '{"nested": "fail"', // missing closing brace
      primitives: [1, 2, 3, null, ""],
    };

    it('should handle "this" root reference', () => {
      expect(query("${this.shortStr}", edgeData)).toBe("Hi");
    });

    it("should handle automatic JSON parsing of stringified objects", () => {
      // Should parse valid JSON
      expect(query("${jsonProp.nested}", edgeData)).toBe("success");
      // Should gracefully fail and return undefined for nested path on bad JSON
      expect(query("${badJsonProp.nested}", edgeData)).toBeUndefined();
    });

    it("should return null/original value when pipes receive invalid inputs", () => {
      expect(query("${empty | slice:0:1}", edgeData)).toBeNull();
      expect(query("${empty | number:2}", edgeData)).toBeNull();
      expect(query("${notANumber | number:2}", edgeData)).toBe("abc");
      expect(query("${empty | currency}", edgeData)).toBeNull();
      expect(query("${notANumber | currency}", edgeData)).toBe("abc");
      expect(query("${empty | formatDuration}", edgeData)).toBeNull();
      expect(query("${notANumber | formatDuration}", edgeData)).toBe("abc");
      expect(query("${empty | formatDate}", edgeData)).toBeNull();
      expect(query("${badDate | formatDate}", edgeData)).toBe(
        "invalid-date-string",
      );
      expect(query("${empty | truncate}", edgeData)).toBeNull();
    });

    it("should handle truncate edge cases (short lengths, invalid lengths)", () => {
      // String shorter than max
      expect(query("${shortStr | truncate:10}", edgeData)).toBe("Hi");
      // Length < 3 (should not add ellipsis)
      expect(query("${longStr | truncate:2}", edgeData)).toBe("He");
      // Invalid/Negative length (should return original)
      expect(query("${longStr | truncate:-5}", edgeData)).toBe("Hello World");
      expect(query("${longStr | truncate:abc}", edgeData)).toBe("Hello World");
    });

    it("should mapJoin primitive arrays and throw on non-arrays", () => {
      expect(() => query("${shortStr | mapJoin}", edgeData)).toThrow(
        "mapJoin pipe requires an array",
      );
      // Should join primitives and ignore nulls/empty strings
      expect(query("${primitives | mapJoin::, }", edgeData)).toBe("1, 2, 3");
    });

    it("should execute all formatDate formats", () => {
      // Testing against a known timestamp (ensure UTC consistency if needed, but standard formats will map)
      const d = { time: "2024-02-15 14:30:45" };
      expect(query("${time | formatDate:hh:mm:ss}", d)).toBe("14:30:45");
      expect(query("${time | formatDate:HH:mm:ss}", d)).toBe("14:30:45");
      expect(query("${time | formatDate:YYYY-MM-DD HH:mm:ss}", d)).toBe(
        "2024-02-15 14:30:45",
      );
      expect(query("${time | formatDate:DD MMM YYYY}", d)).toBe("15 Feb 2024");
      expect(query("${time | formatDate:DD MMMM YYYY}", d)).toBe(
        "15 February, 2024",
      );
      expect(query("${time | formatDate:MMMM-YYYY}", d)).toBe("February-2024");
      expect(query("${time | formatDate:MM-YYYY}", d)).toBe("02-2024");
      expect(query("${time | formatDate:MM/YYYY}", d)).toBe("02/2024");
      // Fallback format
      expect(query("${time | formatDate:UNKNOWN}", d)).toBe(
        "2024-02-15 14:30:45",
      ); // Or similar raw string fallback depending on JS engine
    });

    it("should hit formatDuration hour-scaling branches", () => {
      const d = { hours: 48 }; // 48 hours
      expect(query("${hours | formatDuration:hours:DD:HHH:mm:ss}", d)).toBe(
        "02:000:00:00",
      );
    });
  });

  describe("7. Deep Array Engine Internals", () => {
    const arrayData = {
      items: [
        { id: 1, type: "A", val: 10, nested: { prop: "X" } },
        { id: 2, type: "B", val: 20 },
        { id: 3, type: "C", val: 30 },
      ],
    };

    it("should handle direct index array access with property targeting", () => {
      // Hits: if (/^\d+$/.test(condParts[0]) && condParts.length === 1)
      expect(query("${items[1 && type]}", arrayData)).toBe("B");
    });

    it("should handle all array comparison operators", () => {
      // Hits: ==, !=, >=, <=, >, <
      expect(query("${items[val == 20 && id]}", arrayData)).toBe(2);
      expect(query("${items[val != 20 && id]}", arrayData)).toBe(1); // Finds first one not 20
      expect(query("${items[val >= 30 && id]}", arrayData)).toBe(3);
      expect(query("${items[val <= 10 && id]}", arrayData)).toBe(1);
      expect(query("${items[val > 20 && id]}", arrayData)).toBe(3);
      expect(query("${items[val < 20 && id]}", arrayData)).toBe(1);
    });

    it("should return undefined when array item is not found", () => {
      // Hits: if (!foundItem) { current = undefined; }
      expect(query('${items[type == "Z" && id]}', arrayData)).toBeUndefined();
    });

    it("should handle string literal return with object interpolation", () => {
      // Hits: else if (targetProp.startsWith("'") && targetProp.endsWith("'"))
      // Hits: current = literal.replace(/\$\{object\.([^}]+)\}/g, ...

      // 1. Successful interpolation of nested property
      expect(
        query(
          "${items[type == 'A' && 'Found: ${object.nested.prop}']}",
          arrayData,
        ),
      ).toBe("Found: X");

      // 2. Fallback when interpolated property doesn't exist (val != null ? String(val) : "")
      expect(
        query(
          "${items[type == 'A' && 'Missing: ${object.invalid}']}",
          arrayData,
        ),
      ).toBe("Missing: ");

      // 3. Pure string literal with no interpolation
      expect(query("${items[type == 'B' && 'Just a string']}", arrayData)).toBe(
        "Just a string",
      );
    });
  });
});
