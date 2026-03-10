# **Final Project:**
Webhook-Driven Task Processing Pipeline

## Overview

Build a service that receives webhooks, processes them through a job queue, and delivers results to registered subscribers. Think of it as a simplified Zapier - an inbound event triggers a processing step, and the result is forwarded to one or more destinations.

**Timeline:** 1–2 weeks

**Stack:** TypeScript, SQL (PostgreSQL recommended), Docker, GitHub Actions CI/CD

---

## What You're Building

Your service lets users create **pipelines**. A pipeline connects three things:

1. **A source** — a unique URL that accepts incoming webhooks
2. **A processing action** — something that happens to the incoming data
3. **Subscribers** — one or more URLs where the processed result gets delivered

When a webhook hits a pipeline's source URL, the service should **not** process it synchronously. Instead, it should queue it as a job and process it in the background.

## Core Requirements

- CRUD API for managing pipelines
- Webhook ingestion that queues jobs for background processing
- A worker that picks up and executes jobs
- At least **three** different processing action types (your choice — be creative)
- Result delivery to subscriber URLs with retry logic for failures
- An API to query job status, history, and delivery attempts
- The full service runs via `docker compose up`
- A GitHub Actions CI/CD pipeline
- A README documenting setup, usage, and your design decisions

## What We're Looking For

This project is intentionally underspecified. How you fill in the gaps is part of the evaluation.

| Area | What we're looking at |
| --- | --- |
| **Architecture** | Clean separation of concerns, thoughtful schema design, sensible project structure |
| **Reliability** | Retry logic, error handling, edge cases — what happens when things go wrong? |
| **Code Quality** | Readable TypeScript, proper typing, consistent patterns |
| **Infrastructure** | Docker setup works on first try, CI pipeline is meaningful |
| **Documentation** | README is clear, design decisions are documented explained |
| **Creativity & Polish** | What did you add beyond the minimum? How did you make it your own? |

---

## Stretch Goals

Optional, but a chance to stand out. Prioritize a solid core over half-finished extras.

Some ideas: authentication, webhook signature verification, rate limiting, pipeline chaining, a dashboard UI, metrics, concurrency control. Or come up with your own.

---

## Deliverables

1. **GitHub repository** with clean commit history showing incremental progress
2. **Working Docker Compose setup**
3. **Passing CI pipeline**
4. **README** covering setup, API docs, architecture, and design decisions
5. **Demo** — be prepared to walk through your project, explain decisions, and answer questions

---

## A Note on AI Usage

You are welcome and expected to use AI tools. We do the same in our daily work. What matters is that you **understand what you've built**. During the demo, we'll ask you to explain your decisions, walk through code paths, and debug or extend a feature live. If you can't explain it, it doesn't count.

## Important Note:

Each intern must submit an approx. **10-minute video** including:

- A clear explanation of the project **architecture** and key technical decisions.
- A live **demo** of the working project.

The goal is to assess your depth of understanding, not just the final result.

---

## Project Submission:

[Submit your Final Project here](https://forms.gle/7nNcDYyzDwtAMdc37)