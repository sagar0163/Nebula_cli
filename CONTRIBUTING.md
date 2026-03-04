# Contributing to Nebula-CLI

Thank you for your interest in contributing!

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/Nebula_cli.git
cd Nebula_cli

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test
```

## Code Style

- **ESLint** + **Prettier** for code formatting
- **TypeScript** for new code
- **Conventional Commits** for commit messages

## Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code refactoring
- `test`: Tests
- `chore`: Maintenance

### Example

```
feat(ai): add support for Claude API

- Added Anthropic SDK integration
- Updated router to prioritize Claude for complex tasks

Closes #123
```

## Pull Request Process

1. Create a feature branch: `git checkout -b feature/amazing-feature`
2. Make changes and add tests
3. Ensure all checks pass: `npm run lint && npm test`
4. Commit with conventional message
5. Push and open a PR
6. Wait for review

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# UI mode
npm run test:ui

# Coverage
npm run coverage
```

## Questions?

- Open an issue for bugs/feature requests
- Start a discussion for questions
