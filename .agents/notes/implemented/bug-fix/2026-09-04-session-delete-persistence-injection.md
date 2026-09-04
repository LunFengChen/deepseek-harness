# Agent Note: Inject persistence for session deletion

Status: implemented

English | [中文](2026-09-04-session-delete-persistence-injection.zh.md)

## Problem

The session deletion command accessed `ctx.sessionPersistence`, but the Session Controller did not declare that service in its Cordis injection list. A production web request therefore reached the delete button and failed with a property-access error instead of invoking durable truncation.

## Decision

Declare `sessionPersistence` as a Session Controller dependency and resolve it explicitly in the deletion command. If a direct test or incomplete profile omits the service, return a structured internal error explaining that conversation history cannot be deleted instead of dereferencing an absent context property.

## Alternatives considered

**Keep the undeclared context property:** rejected because Cordis does not guarantee undeclared services on the injected context and the failure is only visible after a user clicks delete.

**Implement deletion in a client-only plugin:** rejected because durable truncation must be coordinated by the host controller with the live Session and persistence writer.

## Consequences

The web profile waits for the persistence service before exposing the Session Controller, and delete requests rewrite the durable JSONL prefix before updating the live Session. Missing persistence now produces a diagnosable Remote error rather than `sessionPersistence` property access failure.
