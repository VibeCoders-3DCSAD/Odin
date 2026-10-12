# Core Financial ERD Views

`core-financial-erd.sql` is the complete physical relationship source. Render it
only when a full cross-domain review is needed.

Render one of the following purpose-specific views for design reviews and
documentation. Each view contains the tables owned by that workflow and small
anchor tables for relationships owned elsewhere. They are diagram sources only;
do not run them against the application database.

| View | DFD stores | Use it for |
| --- | --- | --- |
| `core-financial-erd-foundation-and-cashflow.dbml` | D1-D6 | User ownership, accounts, categories, and cashflow |
| `core-financial-erd-goals-and-debt.dbml` | D7-D10 | Savings, debt, and credit-card repayment |
| `core-financial-erd-planning-and-insights.dbml` | D11-D14 | Plans, forecasts, assessments, and alerts |

Anchor tables intentionally expose only identifiers needed to draw a
relationship. Key columns use singular-table aliases such as `category_id` and
`financial_plan_id`; consult `supabase/public-schema.sql` for live column names.
