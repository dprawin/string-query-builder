# String Query Builder

A lightweight, stateless, functional query builder for extracting, transforming, and formatting data from complex JSON objects using intuitive string templates. Perfect for dynamic UI configurations, messaging templates, and declarative data mapping.

[![npm version](https://img.shields.io/npm/v/string-query-builder.svg)](https://www.npmjs.com/package/string-query-builder)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- **Stateless & Functional:** Tree-shakeable single exported `query` method.
- **Deep Object Traversal:** Safely access deeply nested properties (`user.address.city`).
- **Array Querying:** Find array elements using conditions (`items[type == 'admin' && name]`).
- **Transform Pipes:** Built-in tools for formatting dates, durations, currency, strings, and arrays.
- **Ternary Logic:** Evaluate conditions dynamically inline (`age >= 18 ? 'Adult' : 'Minor'`).
- **Template Literals:** Support for nested string interpolation with backticks.
- **Extensible:** Easily inject custom pipes for your specific business logic.
- **TypeScript Ready:** Fully typed out of the box.

## Installation

```bash
npm install string-query-builder
```
