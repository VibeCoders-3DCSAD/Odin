# Philippine Monthly Spending Reference

The reference supplied for BUDGIE describes conditional budgeting possibilities,
not established causes of household spending changes. The executable catalog is
[`spendingReasonCatalog.ts`](../apps/api/src/services/financialPlan/spendingReasonCatalog.ts).
It contains all twelve months, their candidate category/direction associations,
reported-season category rules, provenance, and the evidence needed for specific
events. It contains no forecast coefficients or adjustment percentages.

## Category boundaries

Use canonical HFCE slugs rather than matching editable display names. The
[PSA national-accounts reference](https://psa.gov.ph/statistics/national-accounts/faqs)
describes the HFCE expenditure categories.

| Code | Application category |
| --- | --- |
| C01 | `food` |
| C02 | `alcohol_tobacco` |
| C03 | `clothing_footwear` |
| C04 | `housing_water_utilities` |
| C05 | `furnishings_household` |
| C06 | `health` |
| C07 | `transport` |
| C08 | `communication` |
| C09 | `recreation_culture` |
| C10 | `education` |
| C11 | `restaurants_hotels` |
| C12 | `miscellaneous_goods_services` |

Groceries, restaurant meals, transport fares, and specific gift items retain
their own categories. A holiday does not turn every expense into Miscellaneous.
Income tax, debt principal, and savings transfers must not become consumption
expenses merely to justify a seasonal reason.

## Evidence selection

1. Match the explicit `planMonth` (`YYYY-MM`), canonical category slug, reference
   candidates, and category rules. Already-issued requests without an explicit
   month can use their English month/year label. Unknown months or categories
   yield no seasonal reason.
2. Match the user's reported higher/lower direction. A reported pattern can differ
   from a generic national expectation; it remains a self-report, not proof of a
   purchase or cause. Saving intentions are not lower-expense evidence.
3. Keep overlapping seasons identifiable. November Transport may match Undas,
   Christmas and Ber Months, and the user's reported rainy-season pattern. Food
   does not inherit a rainy-season explanation merely because November matches.
4. Give dated, recorded scheduled payments priority over broad seasonal context.
   Resolve their category through the saved subcategory foreign key, match the
   exact month and year, and deduplicate payment/date pairs. Use the remaining
   amount after recorded payments, as calculated by the existing reservation
   service. Explain that these payments are reserved separately; never add them
   to the category allocation again.
5. Keep unsupported candidates inactive. Children do not prove tuition is due;
   Christmas preferences do not prove travel or gift purchases; completed trips
   and repairs need explicit completion and nonrecurrence evidence.
6. Use “No specific reason identified.” when neither a matching reported pattern
   nor a recorded payment supports a more specific category explanation.

The category/direction lists retrieve possibilities. They do not create household
facts, reverse a reason's causal meaning, or establish that an expense occurred.

## Calendar and regional conditions

[PAGASA's climate description](https://www.pagasa.dost.gov.ph/index.php/information/climate-philippines)
uses a broad June–November rainy season and explains regional rainfall variation.
The app may refer to a user's selected seasonal pattern; it does not infer local
rain, storms, flooding, damage, illness, or increased utility use from a month.

The supplied reference also mentions Holy Week, Chinese New Year, Eid, school
calendars, festivals, and individual annual payments. These require verified
year-specific dates and applicable household evidence. No such calendar or
participation source is currently connected to this selector, so those specific
event claims remain inactive. The supplied school dates and movable-holiday
dates have not been copied into permanent monthly rules. Existing dated payment
records can still support a generic confirmed-payment explanation in their own
category, without inferring the purpose from a payment name.

## Forecasts and budget limits

Forecast comparisons explicitly use `usual_category_spending`. The percentage
describes the estimated category expense relative to that spending baseline;
it is not a comparison with the previous month's budget limit or a percentage
caused by a season.

Allocations are compared separately with the current spending estimate. When
an allocation is below the estimate, a protected notice states the funds
available for category budgets and actual debt, savings, and scheduled-payment
reservations. It does not claim those reservations are new or that funds fell
from last month. Higher expected expenses may coexist with a lower allocation.

Reported seasonal mismatches are limited to applicable categories. The notice
asks the user to review the category estimate; it never changes the estimate,
allocation, minimum, or reservation.

## Rendering and audit context

AI selects and orders supported evidence IDs. All displayed messages are rendered
from their corresponding evidence type by the server, including forecast,
seasonal, available-money, and missing-money insights. Raw model prose cannot
introduce a purchase, event, changed amount, or confirmed cause. Rendered messages
are deduplicated before merging with protected notices and deterministic insights.

Category explanations retain complete qualifying sentences within the existing
length limit. Confirmed payments take precedence when all possible context cannot
fit. The existing screen displays up to three insights.

The Financial Plan input snapshot stores `spendingExplanationEvidence`, including
the plan month, comparison basis, category baselines/estimates/allocations,
month-matched preferences, confirmed payments, and reservation totals. This keeps
the explanation's original evidence with the accepted plan.

## Provenance

Catalog version and review date: **2026-10-18**. Monthly budgeting possibilities
come from the user-supplied Philippine Monthly Spending Reference. PSA and PAGASA
support category and broad climate context respectively; neither source establishes
personal seasonal causes. Calendar verification remains unset until a verified,
year-specific source is integrated.
