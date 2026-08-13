# Source Structure Guide

## npm Packages

```
opensrc/
└── repos/
    └── github.com/              # npm packages resolve to GitHub
        └── owner/
            └── repo/
                ├── src/         # Source code (usually)
                ├── dist/        # Built output (ignore)
                ├── test/        # Tests (useful for examples)
                ├── package.json # Dependencies, scripts
                └── README.md    # Often has examples
```

## Python Packages (PyPI)

```
opensrc/
└── repos/
    └── github.com/              # Most PyPI packages on GitHub
        └── owner/
            └── repo/
                ├── src/         # or package_name/
                ├── tests/       # Python tests
                ├── setup.py     # Package config
                └── pyproject.toml
```

## Rust Crates

```
opensrc/
└── repos/
    └── github.com/
        └── owner/
            └── repo/
                ├── src/
                │   └── lib.rs   # Main library file
                ├── tests/
                ├── Cargo.toml   # Dependencies
                └── examples/    # Usage examples
```
