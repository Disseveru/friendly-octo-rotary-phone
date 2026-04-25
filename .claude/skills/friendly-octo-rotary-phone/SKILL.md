```markdown
# friendly-octo-rotary-phone Development Patterns

> Auto-generated skill from repository analysis

## Overview
This skill documents the development patterns and conventions used in the `friendly-octo-rotary-phone` repository, a TypeScript project built with the Next.js framework. It covers file naming, import/export styles, commit patterns, and testing conventions to help contributors maintain consistency and quality in the codebase.

## Coding Conventions

### File Naming
- Use **camelCase** for file names.
  - Example: `userProfile.ts`, `fetchData.test.ts`

### Import Style
- Use **absolute imports** for modules.
  - Example:
    ```typescript
    import fetchData from 'utils/fetchData';
    ```

### Export Style
- Use **default exports** for modules.
  - Example:
    ```typescript
    // In utils/fetchData.ts
    const fetchData = () => { /* ... */ };
    export default fetchData;
    ```

### Commit Patterns
- Commit messages are **freeform** (not strictly conventional commits).
- Commonly use short prefixes, average length ~39 characters.
  - Example:  
    ```
    Add user authentication logic
    Fix bug in fetchData utility
    ```

## Workflows

_No automated workflows detected in this repository._

## Testing Patterns

- Test files use the pattern: `*.test.*`
  - Example: `fetchData.test.ts`
- The specific testing framework is **unknown**; check existing test files for framework-specific syntax.
- Example test file structure:
  ```typescript
  // fetchData.test.ts
  import fetchData from 'utils/fetchData';

  test('fetchData returns expected result', () => {
    // test implementation
  });
  ```

## Commands
| Command | Purpose |
|---------|---------|
| /run-tests | Run all test files matching `*.test.*` |
| /lint | Lint the codebase according to project standards |
| /start-dev | Start the Next.js development server |
| /build | Build the Next.js application for production |
```