# Harbor Shop architecture

Harbor Shop is a small online store. The service is split into modules that only talk through the functions they export.

## Modules

- `auth` hashes passwords, keeps sessions and checks the Authorization header.
- `billing` prices invoices, charges cards through the payment provider and handles refunds.
- `http` holds the outgoing HTTP client with retries, a rate limiter and request logging.
- `inventory` reserves stock and chooses the warehouse that ships an order.
- `users` registers customers and stores their accounts.
- `notifications` queues welcome and receipt emails.

## Operations

Backups run from `scripts/backup-database.sh` every night. Logs are rotated by `scripts/rotate-logs.sh`. Finance receives a monthly CSV from `tools/report_generator.py`, and suppliers upload their product lists through `tools/csv_importer.py`.

## Settings

All settings come from environment variables that start with `SHOP_`. The service refuses to start when a required one is missing.
