## 10. Categories and Restrictions Module

### 10.1 Category Taxonomy

- View category groups
- View categories and subcategories
- Navigate through the category hierarchy
- Search categories
- Create custom categories
- Create custom subcategories
- Edit custom categories and subcategories
- Delete custom categories and subcategories with confirmation
- Preserve existing records when a category is deleted

### 10.2 Category Forms

- Category group
- Category label
- Category description
- Filipino-context indicator
- Subcategory kind: Income / Expense / Transfer
- Protected indicator
- Spending restriction: Open / Protected / Fixed

Current category groups are Essentials, Obligatory, Discretionary, and Financial Allocation.

### 10.3 Category Form Placeholders

- Category group: `Select category group`
- Parent category: `Select parent category`
- Category label: `Enter category name`
- Category description: `Add category description`
- Filipino-context indicator: `Mark Filipino-context category`
- Subcategory kind: `Select subcategory kind`
- Protected indicator: `Mark as protected`
- Spending restriction: `Select spending restriction`

### 10.4 Category Selectors

- Category group selector
- Parent category selector for subcategories
- Category and subcategory selector for transactions and obligations
- Subcategory kind selector: Income / Expense / Transfer
- Spending restriction selector: Open / Protected / Fixed
- Filipino-context filter
- Protected-category filter
- System versus custom category filter
- Search and category-group filters may be combined
- Show an empty selector state when no eligible category exists

### 10.5 Category Validation

- Require a category group
- Require a non-empty category label
- Require a parent category when creating a subcategory
- Require a subcategory kind for subcategories
- Prevent duplicate category or subcategory labels within the same parent
- Prevent unsupported restriction changes on system categories
- Prevent deletion of protected or system categories when restricted
- Display validation feedback beside the affected field
- Preserve valid entries after validation failure
- Clear field errors when corrected

### 10.6 Category Context and Restrictions

- Identify Filipino-context categories
- Identify protected categories and subcategories
- Mark spending as open, protected, or fixed
- Apply restrictions to budgeting
- Apply restrictions to recommendations
- Prevent protected spending from being reduced by recommendations
- Prevent deletion of system or protected taxonomy items when restricted

### 10.7 Restriction Rules

- Open spending may be adjusted by budget recommendations
- Protected spending must be preserved by recommendations
- Fixed spending represents a non-reducible allocation
- Restrictions apply to both categories and subcategories

### 10.8 Category States

- Initial state: category management is ready for use
- Loading state: taxonomy or category details are loading
- Empty-list state: no categories or subcategories are available
- Empty-search state: no categories match the search or filters
- Empty-selector state: no eligible parent or transaction category is available
- Category-creation state: category form is open for input
- Subcategory-creation state: subcategory form is open for input
- Validation-failure state: category inputs are invalid
- Saving state: category changes are being saved
- Custom state: category may be edited or deleted by the user
- System state: category is managed by Odin and cannot be freely changed
- Open state: spending may be adjusted by recommendations
- Protected state: spending must be preserved by recommendations
- Fixed state: spending is non-reducible
- Delete-confirmation state: the user must confirm deletion
- Restricted-deletion state: deletion is blocked by system or protection rules
- Records-preserved state: existing records remain readable after category deletion
- Error state: category data could not be loaded or saved
- Success state: category changes were saved

### 10.9 Category Messages

#### Validation Messages

- Invalid category input: `Some category details are not valid. Correct the marked fields and try again.`
- Category validation failure: `Your category could not be saved because some details are invalid. Correct the marked fields and try again.`

#### Error Messages

- No eligible category: `No eligible category is available. Create or choose a different category.`
- System category restriction: `This system category cannot be changed freely. Choose a custom category instead.`
- Restricted deletion: `This category cannot be deleted because it is protected or managed by Odin. Choose a different category.`
- Category error: `Your category data could not be loaded or saved. Try again.`
- Category loading failure: `Your category list could not be loaded. Refresh and try again.`

#### Notice Messages

- Initial state: `Category management is ready. Create or review a category to continue.`
- Empty category list: `No categories or subcategories are available. Create a custom category to get started.`
- Empty category search: `No categories match your search or filters. Change the search or filters and try again.`
- Empty category selector: `No eligible parent or transaction category is available. Create or choose a different category.`
- Category creation: `The category form is ready for a new category. Enter the details and save when you are ready.`
- Subcategory creation: `The subcategory form is ready for a new subcategory. Enter the details and save when you are ready.`
- Custom category: `This custom category can be edited or deleted. Choose an action to manage it.`
- Protected spending: `This spending is protected from reductions. Review another spending category if you need to adjust the plan.`
- Fixed spending: `This spending cannot be reduced. Adjust another open spending category instead.`
- Open spending: `This spending can be adjusted by recommendations. Review or change it when you are ready.`
- System category: `This category is managed by Odin. Choose a custom category when you need to make changes.`
- Records preserved: `Existing records remain readable after this category is deleted. Review the records under their preserved history.`

#### Progress and Success Messages

- Category loading: `Your categories are loading. Wait a moment for the list to appear.`
- Category saving: `Your category changes are being saved. Wait a moment for the update to finish.`
- Category changes saved: `Your category changes were saved. Continue managing your categories.`

#### Confirmation Messages

- Category deletion confirmation: `Deleting this category removes it from future selection but preserves existing records. Cancel to keep it or confirm deletion to continue.`
