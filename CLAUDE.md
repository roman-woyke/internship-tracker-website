# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A shared PHP/MySQL leaderboard for tracking internship applications. Three people each get their own deployed instance (roman, basti, ben) on the same server, each backed by a separate database. The repo is identical across all three branches — only the database credentials differ.

## Running locally

There is no build step, package manager, or test suite. To run locally, you need a PHP + MySQL environment (e.g. XAMPP, Laragon, or Docker). The app requires a `config.php` one directory above the repo root — see the README for its exact format. Without it, every page dies immediately at `require_once __DIR__ . "/../../config.php"`.

## Architecture

### Config and BASE_PATH

`config.php` lives **outside the repo** at the server root. It detects the active deployment subfolder from `$_SERVER["SCRIPT_NAME"]`, sets `BASE_PATH` to that subfolder (e.g. `/basti`), opens a PDO connection into `$pdo`, and defines `INVITE_CODE`. Every PHP file that needs DB access does `require_once __DIR__ . "/../../config.php"`. Every internal link and redirect uses `BASE_PATH` as a prefix — never hardcode paths.

### Request flow

- Pages (`dashboard.php`, `leaderboard.php`, etc.) include `includes/session.php` which requires `config.php` and guards against unauthenticated access.
- `includes/start-session.php` just starts a 30-day session; it does **not** guard.
- API endpoints under `api/` require `start-session.php` (not `session.php`) and check `$_SESSION["user_id"]` themselves, returning HTTP error codes on failure.
- `leaderboard.php` is a shell — it includes `score-table.php` and `score-chart.php` as partials.

### Scoring model

Scores are **additive and permanent**. Every status change is appended to `application_status_history`; nothing is ever updated or deleted there. The PHP function `scorePoints(string $status, ?string $tag): int` in `includes/scoring.php` maps a single history row to its point value. Scores are recomputed at query time by summing all history rows. The `tag` column on `applications` modifies point values for INTERVIEW and OFFER statuses — the tag at the time the history row is inserted is what matters.

`peakStatusSql()` (also in `scoring.php`) returns a SQL `CASE` expression that computes the highest-priority status ever reached by an application; it requires a `LEFT JOIN application_status_history AS h`. This is used in the dashboard and leaderboard to show downgraded applications.

### API endpoints

All return plain text on error (non-200 status) or their payload on success:

| File | Method | Purpose |
|------|--------|---------|
| `api/get-leaderboard.php` | GET | Full leaderboard JSON including per-user applications |
| `api/patch-application.php` | POST | Update `status`, `tag`, `notes`, or `job_link` on an owned application; status changes also write to history |
| `api/delete-application.php` | POST | Delete an owned application (cascades history) |
| `api/get-score-history.php` | GET | Score history events for the chart |
| `api/get-raw-events.php` | GET | Raw history rows |

### Ownership checks

`patch-application.php` and `delete-application.php` always include `AND user_id = ?` in their WHERE clauses — users cannot modify each other's applications even if they know the ID.

## Database schema

See README for the full `CREATE TABLE` statements. Key points:
- `application_status_history` has `ON DELETE CASCADE` from `applications`.
- The `tag` column is on `applications`, not on history rows — but `get-leaderboard.php` joins it through `applications` when computing scores from history.
- Score computation: `get-leaderboard.php` fetches all history rows joined to `applications` (for the tag), then calls `scorePoints()` in a PHP loop.
