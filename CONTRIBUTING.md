# Contributing to Nebula-CLI

Thank you for wanting to contribute to Nebula-CLI! This guide will help you get started.

## 🚀 Quick Start

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/your-username/Nebula_cli.git
   cd Nebula_cli
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feat/amazing-feature
   ```
4. **Make your changes** and follow the coding standards below
5. **Run the test suite** to ensure nothing is broken
6. **Commit your changes** using conventional commits
7. **Push to your fork** and open a Pull Request

## 📋 Development Workflow

### Setting up the project
```bash
# Install dependencies
npm install

# Run type check
npm run type-check

# Run linter
npm run lint

# Run tests
npm test
```

### Code Standards
- Follow the existing code style in the repository
- Use TypeScript type annotations where appropriate
- Write meaningful commit messages using conventional commits format
- Ensure all new features have corresponding tests

### Conventional Commits
All commits must follow the conventional commits format:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style formatting
- `refactor` - Code refactoring
- `test` - Adding missing tests
- `chore` - Routine maintenance

## 🐋 Issue Submission

When submitting an issue, please use the provided templates. If no template fits, use the generic bug report template.

### Bug Report Template
Include:
- **Description**: Clear and concise bug description
- **Steps to reproduce**: Step-by-step reproduction steps
- **Expected behavior**: What you expected to happen
- **Actual behavior**: What actually happened
- **Environment**: OS, Node.js version, Nebula-CLI version
- **Additional context**: Any other relevant information

### Feature Request Template
Include:
- **Problem**: The problem you're trying to solve
- **Proposed solution**: Your idea for a feature
- **Alternative solutions**: Other approaches you've considered
- **Additional context**: Any other relevant information

## 📥 Pull Request Process

1. **Ensure your PR title** follows conventional commits format
2. **Link to related issues** using `Closes #XXXX` or `Fixes #XXXX`
3. **Fill out the PR template** completely
4. **Ensure all tests pass** before requesting review
5. **Address feedback** from reviewers promptly
6. **Squash commits** if requested (maintains clean history)

### PR Template
Please fill out the following in your pull request:

#### Description
What does this PR do? Why is it needed?

#### Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring
- [ ] Test addition

#### How was this tested?
What tests did you run to verify your changes?

#### Screenshots/Videos
If applicable, add screenshots or screen recordings.

#### Checklist:
- [ ] Code follows the project style
- [ ] Type check passes (`npm run type-check`)
- [ ] Lint passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Documentation updated if needed
- [ ] Conventional commit format used

## 🏗️ Project Structure

```
Nebula_cli/
├── src/                  # Source code
├── test/                 # Test files
├── .github/              # GitHub configuration
│   └── templates/        # Issue and PR templates
├── CONTRIBUTING.md       # This file
├── LICENSE               # License file
└── package.json          # Project configuration
```

## 🎯 Good First Issues

Beginner-friendly issues are tagged with `good first issue` and `beginner-friendly`. 

To find them:
```bash
# List good first issues
git issue --good-first-issue

# Or check the GitHub Issues page with the label filter
```

## 👥 Recognition

Contributors are recognized in:
- **Contributor Wall**: Added to `CONTRIBUTING.md` after first PR
- **Sponsor Acknowledgment**: In release notes and website
- **Badges**: Earned for pattern contributions and bug fixes

## 📞 Communication

- **Discord**: Join our community server for real-time discussion
- **GitHub Discussions**: For questions and feature ideas
- **Email**: reach@nebula-cli.com for private matters

## 🙏 Thank You!

Your contribution, big or small, helps make Nebula-CLI better for everyone. Every PR is appreciated and will be reviewed promptly (target: <24hrs).