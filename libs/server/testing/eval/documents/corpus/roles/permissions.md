# Permissions

Permissions are fixed per role; Harbor Shop has no custom roles. This matrix is the source of truth for what each role may do in the Back Office.

## Orders and refunds

| Permission | Owner | Admin | Reviewer | Support Agent | Viewer |
| --- | --- | --- | --- | --- | --- |
| View orders | yes | yes | yes | yes | yes |
| Open refund request | yes | yes | yes | yes | no |
| Approve refund up to 500 EUR | yes | yes | yes | no | no |
| Approve refund above 500 EUR | yes | no | no | no | no |
| Cancel an unshipped order | yes | yes | no | no | no |

## Catalog

| Permission | Owner | Admin | Reviewer | Support Agent | Viewer |
| --- | --- | --- | --- | --- | --- |
| Edit product drafts | yes | yes | yes | no | no |
| Publish a product | yes | yes | yes | no | no |
| Archive a product | yes | yes | no | no | no |
| Change prices in bulk | yes | no | no | no | no |

## Team and settings

| Permission | Owner | Admin | Reviewer | Support Agent | Viewer |
| --- | --- | --- | --- | --- | --- |
| Invite staff members | yes | yes | no | no | no |
| Change a staff role | yes | yes | no | no | no |
| Edit payout bank details | yes | no | no | no | no |
| Export the audit log | yes | yes | no | no | no |
| Close the store | yes | no | no | no | no |

The Auditor role is not in these tables: it can only read and export the audit log while its access period lasts.
