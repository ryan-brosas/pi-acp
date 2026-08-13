---
name: pack-toolchains
description: "Language and runtime router: Python, Go, Rust, Java, .NET, Ruby, PHP, Elixir, defensive shell scripting, and container development conventions."
---

# Language Toolchains

Route language and runtime work. Framework tasks pair ONE toolchain leaf with ONE backend leaf (max two leaves total).

## Members

- python-development: typing, packaging, venv, async, pytest
- go-development: errors, contexts, interfaces, goroutines, modules
- rust-development: ownership, errors, traits, async, Cargo, tests
- java-development: Java 21, Spring Boot, dependency injection, persistence
- dotnet-development: C#, ASP.NET Core, async, DI, Entity Framework, xUnit
- ruby-development: Ruby, Rails, Active Record, jobs, RSpec
- php-development: modern PHP, Composer, Laravel or Symfony, PHPUnit
- elixir-development: OTP, supervisors, GenServer, Ecto, Phoenix
- shell-development: defensive Bash, ShellCheck, Bats
- container-development: Dockerfiles, Compose, multi-stage builds, health checks

## Routing

- Any framework task: one toolchain leaf plus one backend leaf.
- Pure language or script task: the language leaf alone.
- Load no more than two leaves.
