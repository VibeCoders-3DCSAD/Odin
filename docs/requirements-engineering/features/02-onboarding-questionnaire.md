## 2. Onboarding Questionnaire

### 2.1 Guided Onboarding

- Complete a guided financial questionnaire
- Answer multiple-choice and open-input questions
- Validate required answers
- Save and resume incomplete onboarding
- Review answers before submission

### 2.2 Questionnaire Inputs

- Multiple-answer selections
- Single-answer selections
- Text inputs
- Numeric inputs
- Date or age inputs
- Employment and location inputs
- Multiple-answer placeholder: `Select all that apply`
- Single-answer placeholder: `Select an answer`
- Text-input placeholder: `Enter your answer`
- Numeric-input placeholder: `Enter a value`
- Date-input placeholder: `Select a date`
- Employment-input placeholder: `Select employment status`
- Location-input placeholder: `Select your location`

### 2.3 Questionnaire Validation

- Prevent submission when a required answer is empty
- Require at least one selection for multiple-answer questions
- Require one selection for single-answer questions
- Validate text answers against the question's allowed length
- Validate numeric answers as valid, non-negative values where applicable
- Validate dates against the question's allowed range
- Validate employment and location answers against available choices
- Display validation feedback beside the affected question
- Preserve valid answers after validation failure
- Clear question-level errors when the answer is corrected

### 2.4 Questionnaire Empty States

- Empty selection state: show `Select an answer`
- Empty multiple-selection state: show `Select all that apply`
- Empty text state: show `Enter your answer`
- Empty numeric state: show `Enter a value`
- Empty date state: show `Select a date`
- Empty employment state: show `Select employment status`
- Empty location state: show `Select your location`
- Do not treat a placeholder as a submitted answer
- Keep the Continue or Submit action blocked when required answers remain empty

### 2.5 Questionnaire States

- Initial state: questionnaire is ready for input
- Loading state: onboarding questions or saved answers are loading
- Empty-answer state: a required answer has not been provided
- Validation-failure state: one or more answers are invalid
- Saving state: onboarding answers are being saved
- Resume state: incomplete saved answers are being restored
- Review state: completed answers are ready for review
- Submission-error state: onboarding answers could not be submitted
- Save-error state: onboarding answers could not be saved
- Network-required state: onboarding requires an internet connection for this action
- Error state: onboarding data could not be loaded or saved
- Success state: onboarding answers were saved or submitted

### 2.6 Questionnaire Messages

#### Validation Messages

- Required answer: `This answer is required. Provide an answer before continuing.`
- Required multiple selection: `Select at least one answer. Choose an option before continuing.`

#### Onboarding Error Messages

- Reassessment start failure: `We could not start your reassessment. Please try again.`
- Session creation failure: `We could not create your onboarding session. Please try again.`
- Session loading failure: `We could not load your onboarding session. Check your connection and try again.`
- Save failure: `Your answers could not be saved. Please try again.`
- Research eligibility failure: `Your research eligibility could not be saved. Please try again.`
- Submission failure: `Your onboarding submission failed. Please try again.`
- Network failure: `A network error interrupted onboarding. Check your connection and try again.`
- Onboarding error: `Your onboarding data could not be loaded or saved. Check your connection and try again.`

#### Onboarding Notices

- Initial state: `Your onboarding questionnaire is ready. Answer the questions to continue.`
- Loading state: `Your onboarding questionnaire is loading. Please wait a moment.`
- Resume state: `Your saved onboarding answers are ready. Continue where you left off.`
- Review state: `Your answers are ready for review. Check them before submitting.`
- Success state: `Your onboarding answers were saved. Continue to review your financial profile.`
- Research eligibility success: `You are eligible to participate in the research study. You can opt out later through the system settings.`
- Network-required notice: `Onboarding requires an internet connection. Connect to the internet and try again.`

### 2.7 Financial Profile

- Generate an initial financial profile
- View the profile explanation
- Accept or reject the assigned profile
- Manually change the assigned profile
- Request profile reassessment
- View research eligibility separately from app access
