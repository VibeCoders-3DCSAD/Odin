## 14. Forecasting and Financial Intelligence Module

### 14.1 Forecasting

- View income forecasts
- View expense forecasts
- View balance forecasts
- View category forecasts
- View expected recurring events
- View forecast periods
- View forecast explanations
- Refresh forecasts online
- View cached forecasts offline

### 14.2 Forecast Trust Information

- Identify personalized forecasts
- Identify fallback forecasts
- Identify cold-start forecasts
- View forecast confidence and freshness
- View the last forecast update

### 14.3 Anomaly and Overspending Detection

- Detect unusual spending
- Detect overspending risks
- Explain detected spending patterns
- Mark intentional spending as expected
- Manage spending suppression rules

### 14.4 Forecasting States

- Initial state: forecasting is ready for use
- Loading state: forecasts or intelligence results are being generated
- Personalized state: forecasts use sufficient user-specific history
- Fallback state: forecasts use a general fallback method
- Cold-start state: forecasts have limited historical data
- Fresh state: forecast data is current within the freshness window
- Stale state: forecast data is available but requires refresh
- Refreshing state: an online forecast refresh is in progress
- Cached state: the latest available forecast is shown offline
- Empty-data state: insufficient data exists for a meaningful forecast
- Anomaly-detected state: unusual spending has been identified
- Overspending-risk state: spending is projected to exceed a relevant limit
- Expected-spending state: the user marked detected spending as intentional
- Suppressed state: a configured suppression rule hides matching detections
- Error state: forecasts or intelligence results could not be generated
- Success state: forecasts or intelligence results were updated

### 14.5 Forecasting and Intelligence Messages

#### Error Messages

- Forecast generation error: `Your forecasts could not be created. Refresh and try again.`

#### Notice Messages

- Initial state: `Forecasting is ready. Review the available financial outlook or refresh it when you are online.`
- Personalized state: `This forecast uses your financial history. Review the explanation to understand the result.`
- Fallback state: `A general forecast is being shown. Add more financial history for a more personal forecast.`
- Cold-start state: `There is limited financial history for this forecast. Add more activity to improve it.`
- Fresh state: `Your forecast is current within the freshness window. Review the latest results.`
- Stale state: `This forecast may be out of date. Refresh it when you are online.`
- Empty-data state: `There is not enough financial information for a meaningful forecast. Add more activity and try again.`
- Cached state: `You are offline. Review your saved forecast or reconnect to refresh it.`
- Anomaly-detected state: `Unusual spending was detected. Review the pattern and mark it expected if it was intentional.`
- Overspending-risk state: `Spending is projected to exceed a relevant limit. Review the affected category and adjust your plan if needed.`
- Expected-spending state: `This spending was marked as expected. Review the suppression or detection details if you want to change it.`
- Suppressed state: `A suppression rule is hiding matching detections. Review the rule if you want those detections shown again.`

#### Progress and Success Messages

- Loading state: `Loading your financial intelligence. Please wait a moment.`
- Refreshing state: `Refreshing your forecast. Please wait a moment.`
- Success state: `Your forecasts were updated. Review the latest results.`
