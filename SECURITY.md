# Security Policy

## Scope

Clash Blueprint Engine is a self-hosted, open-source library and local editor.
There is **no hosted service, backend, or user data** — it runs entirely on the
machine of whoever clones and builds it. The editor persists layouts only to the
browser's `localStorage`. As such, the realistic security surface is limited to:

- Parsing untrusted input (imported layout JSON / save files).
- The usual supply-chain risk of npm dependencies.

## Supported versions

This project is pre-1.0 and ships from `main`. Security fixes land on `main`;
there are no long-lived release branches to backport to.

## Reporting a vulnerability

Please **do not open a public issue** for a security vulnerability.

- Preferred: use GitHub's **private vulnerability reporting** —
  the **Security** tab → **Report a vulnerability** on this repository.
- Include a description, affected area/package, and reproduction steps (a minimal
  layout JSON or failing test is ideal).

You can expect an acknowledgement within a few days. Because this is a
volunteer-maintained open-source project, fix timelines are best-effort; we'll
keep you updated and credit you in the changelog unless you prefer otherwise.

## Hardening notes

- Imported layouts are validated structurally (`@clash/importer`) and re-validated
  spatially when the aggregate is rebuilt (`Village.fromSnapshot`), and unknown or
  too-new save-format versions are rejected as errors — malformed input fails as a
  `Result`, not a crash.
- Dependencies are monitored by Dependabot and code is scanned by CodeQL.
