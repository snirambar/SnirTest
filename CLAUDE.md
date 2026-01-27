# CLAUDE.md - AI Assistant Guidelines for SnirTest

This file provides guidance for AI assistants (like Claude) working with this repository.

## Repository Overview

**Repository:** SnirTest
**Owner:** snirambar
**Status:** New project (initial setup)

## Project Structure

```
SnirTest/
├── CLAUDE.md          # AI assistant guidelines (this file)
└── .git/              # Git version control
```

*Note: This repository is in its initial state. Update this section as the project grows.*

## Development Workflow

### Branch Strategy

- **Main branch:** Protected, requires pull requests
- **Feature branches:** Use descriptive names with prefixes:
  - `feature/` - New features
  - `fix/` - Bug fixes
  - `docs/` - Documentation updates
  - `refactor/` - Code refactoring
  - `claude/` - AI-assisted development branches

### Git Conventions

1. **Commit messages:** Use clear, descriptive messages
   - Start with a verb (Add, Fix, Update, Remove, Refactor)
   - Keep the first line under 72 characters
   - Add details in the body if needed

2. **Pull requests:**
   - Provide a clear description of changes
   - Reference any related issues
   - Ensure all tests pass before requesting review

## Code Style Guidelines

*To be defined as the project evolves. Common conventions to consider:*

- Use consistent indentation (spaces vs tabs)
- Follow language-specific style guides
- Write self-documenting code with meaningful names
- Add comments for complex logic only

## Testing

*Testing framework and conventions to be established.*

## Build & Run

*Build and run instructions to be added when code is introduced.*

## AI Assistant Instructions

When working with this repository, AI assistants should:

### Do

- Read existing code before making modifications
- Follow established patterns and conventions in the codebase
- Write clean, maintainable code
- Make focused, atomic commits
- Update documentation when making significant changes
- Run tests before committing (when available)
- Ask for clarification when requirements are ambiguous

### Don't

- Over-engineer solutions beyond what's requested
- Add unnecessary dependencies
- Make changes unrelated to the current task
- Skip reading files before editing them
- Commit sensitive information (API keys, credentials, etc.)
- Force push to shared branches
- Create files unnecessarily when editing existing ones works

### Security Considerations

- Never commit secrets, API keys, or credentials
- Validate and sanitize user inputs
- Be aware of OWASP top 10 vulnerabilities
- Use parameterized queries for database operations
- Escape output appropriately to prevent XSS

## Common Tasks

### Adding a New Feature

1. Create a feature branch from main
2. Implement the feature with tests
3. Update relevant documentation
4. Create a pull request with clear description

### Fixing a Bug

1. Identify and understand the root cause
2. Create a fix branch
3. Write a test that reproduces the bug
4. Implement the fix
5. Verify all tests pass
6. Create a pull request

## Environment Setup

*Environment setup instructions to be added as the project develops.*

## Dependencies

*Project dependencies to be documented here.*

## Additional Resources

- [Project Wiki](#) - *To be created*
- [Issue Tracker](#) - *To be set up*
- [CI/CD Pipeline](#) - *To be configured*

---

*Last updated: 2026-01-27*
