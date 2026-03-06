# String Query Builder

A lightweight, stateless, and fully type-safe functional query builder for extracting, transforming, and formatting data from complex JSON objects using intuitive string templates.

Perfect for dynamic UI configurations, declarative data mapping, and message templating in both frontend (Angular, React) and backend (Node.js) environments.

[![npm version](https://img.shields.io/npm/v/string-query-builder.svg)](https://www.npmjs.com/package/string-query-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## 🚀 Features

- **Stateless & Functional:** Tree-shakeable single exported `query` method. No class instantiations required.
- **Deep Object Traversal:** Safely access deeply nested properties (`${user.address.city}`).
- **Advanced Array Querying:** Find array elements using conditions (`items[type == 'admin' && name]`).
- **Transform Pipes:** 9 built-in tools for formatting dates, durations, currency, strings, and arrays.
- **Ternary Logic:** Evaluate conditions dynamically inline (`age >= 18 ? 'Adult' : 'Minor'`).
- **Template Literals:** Support for nested string interpolation with backticks.
- **Extensible:** Easily inject custom pipes for your specific business logic.
- **TypeScript Ready:** Fully typed out of the box.

## 📦 Installation

```bash
npm install string-query-builder
# or
yarn add string-query-builder
# or
pnpm add string-query-builder
```

## ⚡️ Quick Start

```js
import { query } from "string-query-builder";

const data = {
  user: { firstName: "John", lastName: "Doe", role: "admin" },
  metrics: { loginCount: 42 },
};

// 1. Simple extraction
console.log(query("${user.firstName}", data));
// Output: "John"

// 2. Using a built-in pipe
console.log(query("${user.role | uppercase}", data));
// Output: "ADMIN"

// 3. Inline ternary logic
console.log(query("${metrics.loginCount > 10 ? 'Active' : 'New'}", data));
// Output: "Active"
```

## 📖 Feature Guide

### 1. Property & Array Access

Access deep properties or array indices safely. If a property doesn't exist, it gracefully returns `undefined` without throwing errors.

```js
const payload = {
  company: { name: "TechCorp" },
  tags: ["software", "saas", "enterprise"],
};

query("${company.name}", payload); // "TechCorp"
query("${tags.length}", payload); // 3
query("${tags[1]}", payload); // "saas"
query("${company.ceo}", payload); // undefined
```

### 2. Array Conditionals (The Finder Syntax)

You can search through arrays using intuitive logical operators (`==`, `!=`, `<`, `>`, `<=`, `>=`) or simple truthy checks.

**Syntax:** `${arrayName[condition && propertyToExtract]}`

```js
const data = {
  products: [
    { id: 1, type: "digital", price: 29.99, isAvailable: true },
    { id: 2, type: "physical", price: 50.0, isAvailable: false },
  ],
};

// Find the price of the 'physical' product
query("${products[type == 'physical' && price]}", data); // 50

// Find ID of the first available product using a truthy check
query("${products[isAvailable && id]}", data); // 1

// Return a custom string literal if the condition is met
query("${products[type == 'digital' && 'Found Digital Item']}", data); // "Found Digital Item"

// Interpolate the found object's properties into a string literal
query("${products[type == 'digital' && 'ID is ${object.id}']}", data); // "ID is 1"
```

### 3. Ternary Operators

Evaluate conditions inline. The engine safely parses strings and numbers.

```js
const data = { user: { age: 25, credits: 0 } };

query("${user.age >= 18 ? 'Adult' : 'Minor'}", data); // "Adult"

// Truthy checks
query("${user.credits ? 'Has Credits' : 'Empty Wallet'}", data); // "Empty Wallet"
```

### 4. Template Literals (Nested Interpolation)

Use backticks (`) inside the query to interpolate multiple dynamic values into a single string.

```js
const data = { user: { name: "Arjun", role: "admin" }, items: [1, 2, 3] };

query("${`Welcome, ${user.name}! You have ${items.length} items.`}", data);
// "Welcome, Arjun! You have 3 items."
```

## 🪈 Built-In Pipes Reference

Pipes allow you to transform data right before it is returned. You can chain multiple pipes together using the `|` character.

| Pipe             | Description                             | Example Syntax                              | Output Example      |
| ---------------- | --------------------------------------- | ------------------------------------------- | ------------------- |
| `uppercase`      | Converts string to uppercase            | `${name \| uppercase}`                      | `JOHN`              |
| `lowercase`      | Converts string to lowercase            | `${name \| lowercase}`                      | `john`              |
| `slice`          | Extracts a section of a string/array    | `${name \| slice:0:2}`                      | `Jo`                |
| `truncate`       | Truncates text and appends `...`        | `${desc \| truncate:10}`                    | `Hello W...`        |
| `number`         | Formats a number to decimal places      | `${price \| number:2}`                      | `29.99`             |
| `currency`       | Formats as currency (`symbol:decimals`) | `${price \| currency:€:1}`                  | `€29.9`             |
| `formatDate`     | Parses dates/Unix timestamps            | `${time \| formatDate:YYYY-MM-DD}`          | `2024-01-15`        |
| `formatDuration` | Converts seconds/minutes to clock       | `${dur \| formatDuration:seconds:HH:mm:ss}` | `01:05:00`          |
| `mapJoin`        | Extracts property from array and joins  | `${items \| mapJoin:type:', '}`             | `digital, physical` |

### 🕒 Date & Duration Formatting

The `formatDate` pipe automatically handles standard date strings, ISO strings, and Unix timestamps (both seconds and milliseconds).  
Supported formats: `YYYY-MM-DD`, `hh:mm:ss`, `HH:mm:ss`, `YYYY-MM-DD HH:mm:ss`, `DD MMM YYYY`, `DD MMMM YYYY`, `MMMM-YYYY`, `MM-YYYY`, `MM/YYYY`.

The `formatDuration` pipe takes two arguments: the input unit (`seconds`, `minutes`, `hours`) and the output format (`HH:mm:ss`, `HHH:mm:ss`, `DD:HHH:mm:ss`).

## 🛠 Custom Pipes

You can easily extend the engine by passing custom pipes via the optional third `options` argument. Custom pipes can also override built-in pipes.

```js
import { query } from 'string-query-builder';

const data = { user: { email: "john.doe@example.com" } };

const options = {
  pipes: {
    // Custom pipe to mask an email address
    maskEmail: (email: string) => {
      if (!email) return email;
      const [name, domain] = email.split('@');
      return `${name.charAt(0)}***@${domain}`;
    },
    // Custom pipe with arguments
    append: (val: string, suffix: string) => `${val}${suffix}`
  }
};

console.log(query("${user.email | maskEmail}", data, options));
// "j***@example.com"

console.log(query("${user.email | append:-TEST}", data, options));
// "john.doe@example.com-TEST"
```

## 🧪 Testing & Code Coverage

This package is thoroughly tested and maintains **100% Code Coverage**.  
If you are contributing, ensure all tests pass:

```bash
npm run test
npm run coverage
```
