# Contributing to FileSyncer

Thank you for your interest in contributing to FileSyncer! 🎉

## Development Setup

1. Fork and clone the repository:
```bash
git clone https://github.com/yourusername/filesyncer.git
cd filesyncer
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Test your changes:
```bash
npm run build && node dist/cli.js init
```

## Development Workflow

1. Create a feature branch:
```bash
git checkout -b feature/your-feature-name
```

2. Make your changes in the `src/` directory

3. Build and test:
```bash
npm run build
```

4. Commit your changes:
```bash
git commit -m "feat: add your feature description"
```

5. Push and create a Pull Request

## Code Style

- Use TypeScript strict mode
- Follow existing code patterns
- Add JSDoc comments for public methods
- Keep functions focused and small
- Use meaningful variable names

## Commit Convention

We follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `refactor:` Code refactoring
- `test:` Test additions/changes
- `chore:` Maintenance tasks

## Pull Request Guidelines

1. Update README.md if needed
2. Add tests if applicable
3. Ensure code builds without errors
4. Describe your changes clearly
5. Link related issues

## Questions?

Feel free to open an issue for discussion!
