# Changelog

## 5.4.0 (2026-02-21)

### Features

* **ci:** add ESLint and Prettier for code quality ([7a682d8](https://github.com/sagar0163/Nebula_cli/commit/7a682d8ea7982c8e730465d968c6a847086cb032)), closes [#7](https://github.com/sagar0163/Nebula_cli/issues/7)
* **cli:** add --verbose, --quiet, --config, --help flags ([2cbbd6c](https://github.com/sagar0163/Nebula_cli/commit/2cbbd6cc98397126ed9c1e8097af6a0499243fea)), closes [#10](https://github.com/sagar0163/Nebula_cli/issues/10)
* **security:** add .nvmrc and CI security audit ([b3dfa38](https://github.com/sagar0163/Nebula_cli/commit/b3dfa38feb0d8800a8283be27a23fb254cfa53f5)), closes [#9](https://github.com/sagar0163/Nebula_cli/issues/9)
* **test:** add vitest setup and unit tests ([f6a9eeb](https://github.com/sagar0163/Nebula_cli/commit/f6a9eeb1936e0c73e2e226e69e0581d9a8c9f096)), closes [#6](https://github.com/sagar0163/Nebula_cli/issues/6)
* **v5.3.0:** implement proactive detective loop and artifact RAG ([94b863d](https://github.com/sagar0163/Nebula_cli/commit/94b863d8c01159e5d9026451c142310d9d36a070))

### Bug Fixes

* allow safe git commands in safe-guard ([1f0c8af](https://github.com/sagar0163/Nebula_cli/commit/1f0c8af80b18f2ae75165aa3fbb8bf686a9a916d)), closes [#11](https://github.com/sagar0163/Nebula_cli/issues/11)
* block command injection via semicolons, pipes, && ([8b3662b](https://github.com/sagar0163/Nebula_cli/commit/8b3662bf71cef68c25bf453a4a7faa7582c86338)), closes [#12](https://github.com/sagar0163/Nebula_cli/issues/12)
* block path traversal attempts in safe-guard ([8e2b7ba](https://github.com/sagar0163/Nebula_cli/commit/8e2b7badc4567e68b67ab708fc1f7d4221eb6608)), closes [#13](https://github.com/sagar0163/Nebula_cli/issues/13)
* block single pipe command chaining ([fb2c2e5](https://github.com/sagar0163/Nebula_cli/commit/fb2c2e519fa93c85700349d46ad9aee06d032e9c)), closes [#17](https://github.com/sagar0163/Nebula_cli/issues/17)
* block SQL injection attempts in safe-guard ([e3811a3](https://github.com/sagar0163/Nebula_cli/commit/e3811a316e307b34a4bf7a4cc2a72c93f155fb8c)), closes [#14](https://github.com/sagar0163/Nebula_cli/issues/14)
* handle missing config file gracefully ([f527cc5](https://github.com/sagar0163/Nebula_cli/commit/f527cc59799c95549bede5d5d1260656ada337c1)), closes [#16](https://github.com/sagar0163/Nebula_cli/issues/16)
* handle unknown CLI flags gracefully ([aaa95f1](https://github.com/sagar0163/Nebula_cli/commit/aaa95f1ba882234e9bd15ed2bad9ae4100caf583)), closes [#15](https://github.com/sagar0163/Nebula_cli/issues/15)

## 5.3.0 (2026-02-21)

### Features

* **ci:** add ESLint and Prettier for code quality ([7a682d8](https://github.com/sagar0163/Nebula_cli/commit/7a682d8ea7982c8e730465d968c6a847086cb032)), closes [#7](https://github.com/sagar0163/Nebula_cli/issues/7)
* **cli:** add --verbose, --quiet, --config, --help flags ([2cbbd6c](https://github.com/sagar0163/Nebula_cli/commit/2cbbd6cc98397126ed9c1e8097af6a0499243fea)), closes [#10](https://github.com/sagar0163/Nebula_cli/issues/10)
* **security:** add .nvmrc and CI security audit ([b3dfa38](https://github.com/sagar0163/Nebula_cli/commit/b3dfa38feb0d8800a8283be27a23fb254cfa53f5)), closes [#9](https://github.com/sagar0163/Nebula_cli/issues/9)
* **test:** add vitest setup and unit tests ([f6a9eeb](https://github.com/sagar0163/Nebula_cli/commit/f6a9eeb1936e0c73e2e226e69e0581d9a8c9f096)), closes [#6](https://github.com/sagar0163/Nebula_cli/issues/6)
* **v5.3.0:** implement proactive detective loop and artifact RAG ([94b863d](https://github.com/sagar0163/Nebula_cli/commit/94b863d8c01159e5d9026451c142310d9d36a070))

### Bug Fixes

* allow safe git commands in safe-guard ([1f0c8af](https://github.com/sagar0163/Nebula_cli/commit/1f0c8af80b18f2ae75165aa3fbb8bf686a9a916d)), closes [#11](https://github.com/sagar0163/Nebula_cli/issues/11)
* block command injection via semicolons, pipes, && ([8b3662b](https://github.com/sagar0163/Nebula_cli/commit/8b3662bf71cef68c25bf453a4a7faa7582c86338)), closes [#12](https://github.com/sagar0163/Nebula_cli/issues/12)
* block path traversal attempts in safe-guard ([8e2b7ba](https://github.com/sagar0163/Nebula_cli/commit/8e2b7badc4567e68b67ab708fc1f7d4221eb6608)), closes [#13](https://github.com/sagar0163/Nebula_cli/issues/13)
* block single pipe command chaining ([fb2c2e5](https://github.com/sagar0163/Nebula_cli/commit/fb2c2e519fa93c85700349d46ad9aee06d032e9c)), closes [#17](https://github.com/sagar0163/Nebula_cli/issues/17)
* block SQL injection attempts in safe-guard ([e3811a3](https://github.com/sagar0163/Nebula_cli/commit/e3811a316e307b34a4bf7a4cc2a72c93f155fb8c)), closes [#14](https://github.com/sagar0163/Nebula_cli/issues/14)
* handle missing config file gracefully ([f527cc5](https://github.com/sagar0163/Nebula_cli/commit/f527cc59799c95549bede5d5d1260656ada337c1)), closes [#16](https://github.com/sagar0163/Nebula_cli/issues/16)
* handle unknown CLI flags gracefully ([aaa95f1](https://github.com/sagar0163/Nebula_cli/commit/aaa95f1ba882234e9bd15ed2bad9ae4100caf583)), closes [#15](https://github.com/sagar0163/Nebula_cli/issues/15)

## [5.1.0](https://github.com/sagar0163/Nebula_cli/compare/v5.0.2...v5.1.0) (2026-01-02)

## [5.0.3](https://github.com/sagar0163/Nebula_cli/compare/v5.0.2...v5.0.3) (2026-01-02)

## [5.0.3](https://github.com/sagar0163/Nebula_cli/compare/v5.0.2...v5.0.3) (2026-01-02)

## [5.0.3](https://github.com/sagar0163/Nebula_cli/compare/v5.0.2...v5.0.3) (2026-01-02)

## [5.0.2](https://github.com/sagar0163/Nebula_cli/compare/v5.0.1...v5.0.2) (2026-01-02)

## [5.0.1](https://github.com/sagar0163/Nebula_cli/compare/v5.0.0...v5.0.1) (2026-01-02)

## [5.0.0](https://github.com/sagar0163/Nebula_cli/compare/v4.20.0...v5.0.0) (2026-01-02)
