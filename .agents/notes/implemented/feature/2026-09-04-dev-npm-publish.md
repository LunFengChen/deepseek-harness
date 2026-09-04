# Agent Note: Development branch npm publication

Status: implemented

English | [中文](2026-09-04-dev-npm-publish.zh.md)

## Problem

The development branch must publish its independently rescoped `@x1a0f3n9/dsh-*` package line without allowing a push from a feature branch or a tag from another release family to publish it.

## Decision

The development branch's release workflow runs validation on pull requests and on `dev-x1a0f3n9` pushes. A successful push may publish the dsh family, and the release verifier accepts that exact branch ref through `RELEASE_PUBLISH_ALLOW_REF`. Tag-triggered manual publication remains available through the existing tag gate.

The package version still comes from the repository's release bump commit. A development push with a version already published at identical integrity is idempotent; changed package bytes require a new version before the push.

## Alternatives considered

**Publish every commit under a generated version:** this would make package versions depend on CI implementation details and would prevent the repository's release scripts from remaining the source of version truth.

**Allow any branch to publish:** this would let an unreviewed feature branch write to the development package line.

**Keep master-only publication:** this would leave the development package scope unavailable to users until a stable merge.

## Consequences

- `dev-x1a0f3n9` pushes publish `@x1a0f3n9/dsh-*` when the versioned artifacts are new or unchanged.
- Feature-branch pull requests still run packing and install-layout checks without credentials.
- The same release verifier can protect either stable or development workflows by comparing one exact allowed ref.
