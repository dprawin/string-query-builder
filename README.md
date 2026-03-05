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
