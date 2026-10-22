## 11. Income and Expense Categories

### 11.1 Category Browsing

- Allow users to view their categories and open a category to review its subcategories.
- Show category and subcategory names, descriptions, icons, and colors.
- Show the number of subcategories within each category.
- Identify protected subcategories and indicate when a category contains protected subcategories.
- Allow users to return from a subcategory list to the category list.
- Provide clear empty views when no categories or subcategories exist.

### 11.2 Custom Category Creation

- Allow users to create custom categories with meaningful names and descriptions.
- Require a non-empty name and description before saving.
- Allow users to choose an icon and color to help identify the category throughout the application.
- Make newly created categories available in the category list and allow users to add subcategories within them.

### 11.3 Subcategory Management

- Allow users to create expense subcategories within the category they are viewing.
- Require a meaningful name and description for each subcategory.
- Allow users to choose a subcategory icon and color, with icon choices appropriate to the parent category.
- Allow users to mark or unmark a subcategory as Protected.
- Allow users to edit existing subcategory names, descriptions, appearance, and Protected designation.
- Keep the parent category clear while users create or edit a subcategory.
- Refresh the subcategory list after changes are saved.

### 11.4 Subcategory Deletion

- Allow users to delete a subcategory after explicit confirmation.
- Explain that deletion removes the subcategory from future selection while preserving existing transactions that use it.
- Preserve historical transaction amounts and account balances when a subcategory is deleted.
- Remove deleted subcategories from current category lists and future transaction selectors.

### 11.5 Category Use Across the Application

- Make eligible income and expense categories available to the features that classify transactions, income sources, and financial commitments.
- Filter transaction category choices according to whether the user is recording income or an expense.
- Allow ordinary transfers to be recorded without a category, as defined in Cash Flow Management.
- Use category assignments to organize financial summaries, spending analysis, forecasts, and Financial Planning.
- Display category appearance consistently where category icons and colors are used.
- Keep existing historical records readable when a subcategory is removed from future selection.
- Treat the Protected designation separately from the minimum and fixed allocation rules used by Financial Planning; do not assume that the designation alone establishes a non-reducible budget amount.

### 11.6 Feedback and Availability

- Show clear loading, saving, empty, success, and error feedback when browsing or managing categories.
- Allow users to retry loading when category data cannot be retrieved.
- Explain invalid entries and preserve users' valid entries when saving fails.
- Allow users to cancel category or subcategory creation and editing without saving changes.
- Keep category data scoped to the current user's account.
