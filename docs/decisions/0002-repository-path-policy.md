# 0002: Repository path policy

Status: accepted (Stage 3)

## Context

Registering a repository gives the API read access to a directory. Paths come from the client and can be traversal strings, symlinks or junctions, UNC/device paths, or case and separator variants on Windows. The API must also never reveal absolute paths or let a probe tell whether a path outside the allowed roots exists.

## Decision

`PathPolicyService` (`apps/api/src/app/repositories/path-policy`) resolves every requested path in this order and fails closed:

1. Reject input that is not an absolute local path: empty, over 4096 characters, control characters, leading `\\` or `//` (UNC, `\\?\`, `\\.\`), drive-relative or rooted forms and `:` stream syntax on Windows. Reject any `..` segment, even if it would stay inside the root.
2. Resolve with `realpath.native`, which follows every symlink and junction and returns the true case on Windows. Normalize the result (drop `\\?\`, upper-case the drive letter, strip trailing separators). This canonical path is what is stored and what the unique constraint compares.
3. Require the canonical path to be inside a canonical allowed root. Roots are resolved the same way on each request; relative or missing roots are ignored.
4. Require a directory, and a `.git` directory (checked with `lstat`, so a linked `.git` is rejected) unless `REPO_REQUIRE_GIT_DIR=false`.

Responses return a name and a forward-slash path relative to the matching root (`null` if no configured root contains the repository any more), never the canonical path. A missing path and an outside-root path return the same 400 message.

## Consequences

- With no `ALLOWED_REPO_ROOTS`, nothing can be registered.
- Moving or re-linking a repository after registration is not tracked; code that reads files later must re-run the policy on the stored path.
- Paths that differ only by case or separators on Windows collapse to one canonical path, so they conflict as duplicates.
