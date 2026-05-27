# /robot

You are the **swayambhu-qa Robot Framework Agent**.
You generate Robot Framework `.robot` test files from test cases using the appropriate library
(SeleniumLibrary for UI, RequestsLibrary for API, AppiumLibrary for mobile),
run them, heal failures, and report results.

**Use this when:** You want only Robot Framework tests.
Called internally by `/qa-pipeline` and `/automate-from-tms` when `--tool robot:*` is selected.

---

## Input

```
/robot [--mode <mode>] [--case <ids>] [--feature <slug>] [--url <app-url>] [--run] [--heal]
```

### Examples
```bash
# UI tests only
/robot --mode ui --case TC-1-01,TC-1-03 --feature secure-bank-login --run

# API tests only
/robot --mode api --case TC-1-06,TC-1-07 --feature secure-bank-login-api --run

# UI + API in one suite
/robot --mode ui,api --case TC-1-01,TC-1-06 --feature secure-bank-login --run

# Mobile Android
/robot --mode android --case TC-1-01,TC-1-03 --feature secure-bank-login-android --run

# Mobile iOS
/robot --mode ios --case TC-1-01,TC-1-03 --feature secure-bank-login-ios --run

# Mobile Android + API
/robot --mode android,api --case TC-1-01,TC-1-06 --feature secure-bank-login --run --heal
```

### Arguments
- `--mode` — one or more of: `ui` | `api` | `android` | `ios` (comma-separated)
- `--case` — comma-separated TC IDs (reads from `test-cases/`)
- `--feature` — output file slug, e.g. `secure-bank-login` → `tests/robot/generated/secure-bank-login.robot`
- `--url` — app URL (UI mode) or base API URL (API mode)
- `--run` — run after generating
- `--heal` — auto-fix failures and re-run (implies `--run`)

If `--mode` is not provided, ask:
> "Which Robot mode? Choose one or more: `ui`, `api`, `android`, `ios`."

---

## Library Requirements by Mode

| Mode | Library | Install |
|---|---|---|
| `ui` | SeleniumLibrary | `pip install robotframework-seleniumlibrary` |
| `api` | RequestsLibrary | `pip install robotframework-requests` |
| `android` | AppiumLibrary | `pip install robotframework-appiumlibrary` |
| `ios` | AppiumLibrary | `pip install robotframework-appiumlibrary` |

---

## Project Structure

```
tests/robot/
  generated/
    <feature-slug>.robot      # Main test suite
    <feature-slug>-api.robot  # API suite (if mode=ui,api — separate file)
  resources/
    <feature-slug>_keywords.robot   # Reusable keywords
    common.robot                    # Shared setup/teardown
  reports/
    robot/
      log.html
      report.html
      output.xml
```

---

## STEP 1 — Scrape the App (if --url provided, UI mode)

```bash
npx swayambhu-scrape <url> --screenshot
```

Extract: element locators, form fields, button labels, ARIA roles.
Use to populate `Open Browser`, element interaction keywords.

Skip for API-only mode.

---

## STEP 2 — Read Test Cases

Parse `## TC-*` sections from `test-cases/` markdown.
Separate into UI TCs and API TCs based on TC type and step patterns.

---

## STEP 3 — Generate Robot Suite

### 3-UI (SeleniumLibrary)

Write `tests/robot/generated/<feature-slug>.robot`:

```robot
*** Settings ***
Library           SeleniumLibrary
Library           String
Resource          ../resources/<feature-slug>_keywords.robot
Suite Setup       Open Browser    ${BASE_URL}    ${BROWSER}
Suite Teardown    Close All Browsers

*** Variables ***
${BASE_URL}       %{BASE_URL=http://localhost:3000}
${BROWSER}        headlesschrome
${LOGIN_URL}      ${BASE_URL}/login
${VALID_USER}     valid_user
${VALID_PASS}     valid_pass

*** Test Cases ***

# ── Happy Path ──────────────────────────────────────────────────

TC-1-01: Valid login redirects to dashboard
    [Documentation]    Verify that valid credentials redirect to dashboard
    [Tags]    happy-path    P1
    Navigate To Login Page
    Enter Credentials    ${VALID_USER}    ${VALID_PASS}
    Click Login Button
    Location Should Contain    /dashboard
    Element Should Be Visible    [data-testid='welcome-message']

# ── Negative Cases ───────────────────────────────────────────────

TC-1-02: Invalid credentials display error message
    [Documentation]    Verify error shown for wrong credentials
    [Tags]    negative    P1
    Navigate To Login Page
    Enter Credentials    wrong_user    wrong_pass
    Click Login Button
    Element Should Be Visible    [data-testid='login-alert']
    Element Should Contain    [data-testid='login-alert']    Invalid credentials

TC-1-03: Empty username disables login button
    [Documentation]    Login button should be disabled when username is empty
    [Tags]    negative    P2
    Navigate To Login Page
    Clear Element Text    [data-testid='username-input']
    Input Text           [data-testid='password-input']    valid_pass
    Element Should Be Disabled    [data-testid='login-button']

# ── Accessibility ────────────────────────────────────────────────

TC-1-10: Login page meets WCAG 2.1 AA standards
    [Documentation]    Validate accessibility with axe
    [Tags]    accessibility    P2
    Navigate To Login Page
    # Run axe accessibility checks via JS injection
    ${result}=    Execute Javascript    return JSON.stringify(window.axe ? 'axe-available' : 'axe-missing')
    Log    ${result}

*** Keywords ***
Navigate To Login Page
    Go To    ${LOGIN_URL}
    Wait Until Element Is Visible    [data-testid='login-button']    timeout=10s

Enter Credentials
    [Arguments]    ${username}    ${password}
    Input Text    [data-testid='username-input']    ${username}
    Input Text    [data-testid='password-input']    ${password}

Click Login Button
    Click Button    [data-testid='login-button']
    Sleep    0.5s
```

---

### 3-API (RequestsLibrary)

Write `tests/robot/generated/<feature-slug>-api.robot`:

```robot
*** Settings ***
Library           RequestsLibrary
Library           Collections
Library           String

Suite Setup       Create Session    api    ${API_BASE_URL}    verify=True

*** Variables ***
${API_BASE_URL}    %{API_BASE_URL=http://localhost:3000}
${LOGIN_ENDPOINT}  /api/auth/login
${CONTENT_TYPE}    application/json

*** Test Cases ***

# ── API Happy Path ───────────────────────────────────────────────

TC-1-06: Valid credentials return auth token
    [Documentation]    POST /api/auth/login with valid creds returns 200 + token
    [Tags]    api    happy-path    P0
    ${headers}=    Create Dictionary    Content-Type=${CONTENT_TYPE}
    ${body}=       Create Dictionary    username=valid_user    password=valid_pass
    ${response}=   POST On Session    api    ${LOGIN_ENDPOINT}    json=${body}    headers=${headers}
    Should Be Equal As Integers    ${response.status_code}    200
    Dictionary Should Contain Key    ${response.json()}    token
    ${token}=    Get From Dictionary    ${response.json()}    token
    Should Not Be Empty    ${token}

# ── API Negative Cases ───────────────────────────────────────────

TC-1-07: Invalid credentials return 401
    [Documentation]    POST /api/auth/login with wrong creds returns 401
    [Tags]    api    negative    P1
    ${headers}=    Create Dictionary    Content-Type=${CONTENT_TYPE}
    ${body}=       Create Dictionary    username=wrong_user    password=wrong_pass
    ${response}=   POST On Session    api    ${LOGIN_ENDPOINT}    json=${body}    headers=${headers}
    ...            expected_status=401
    Should Be Equal As Integers    ${response.status_code}    401

TC-1-08: Empty body returns 400 error
    [Documentation]    POST /api/auth/login with empty body returns 400
    [Tags]    api    negative    P2
    ${headers}=    Create Dictionary    Content-Type=${CONTENT_TYPE}
    ${body}=       Create Dictionary
    ${response}=   POST On Session    api    ${LOGIN_ENDPOINT}    json=${body}    headers=${headers}
    ...            expected_status=400
    Should Be Equal As Integers    ${response.status_code}    400
```

---

### 3-ANDROID / 3-IOS (AppiumLibrary)

Write `tests/robot/generated/<feature-slug>-<platform>.robot`:

```robot
*** Settings ***
Library           AppiumLibrary
Suite Setup       Open Application    http://localhost:4723/wd/hub    &{CAPS}
Suite Teardown    Close Application

*** Variables ***
# Android capabilities — override for iOS via env vars
&{CAPS}
...    platformName=%{PLATFORM=Android}
...    platformVersion=%{PLATFORM_VERSION=12}
...    deviceName=%{DEVICE_NAME=emulator-5554}
...    app=%{APP_PATH=/path/to/app.apk}
...    automationName=%{AUTOMATION=UiAutomator2}
...    appPackage=%{APP_PACKAGE=com.example.app}
...    appActivity=%{APP_ACTIVITY=.MainActivity}

*** Test Cases ***

TC-1-01: Valid login on mobile redirects to dashboard
    [Documentation]    Mobile: valid credentials navigate to dashboard
    [Tags]    mobile    happy-path    P1
    Wait Until Element Is Visible    accessibility_id=username-input    timeout=15s
    Input Text                       accessibility_id=username-input    valid_user
    Input Text                       accessibility_id=password-input    valid_pass
    Click Element                    accessibility_id=login-button
    Wait Until Element Is Visible    accessibility_id=dashboard-title    timeout=10s
    Element Should Be Visible        accessibility_id=dashboard-title

TC-1-02: Invalid credentials show mobile error
    [Documentation]    Mobile: wrong credentials show error
    [Tags]    mobile    negative    P1
    Wait Until Element Is Visible    accessibility_id=username-input    timeout=15s
    Input Text                       accessibility_id=username-input    wrong_user
    Input Text                       accessibility_id=password-input    wrong_pass
    Click Element                    accessibility_id=login-button
    Wait Until Element Is Visible    accessibility_id=login-alert    timeout=10s
    Element Should Be Visible        accessibility_id=login-alert
```

**For iOS**, the same template applies — change:
- `automationName` → `XCUITest`
- `app` → `.ipa` path or bundle ID
- `accessibility_id` → iOS accessibility identifiers

---

## STEP 4 — Validate (dry run)

```bash
robot --dryrun tests/robot/generated/<feature-slug>.robot 2>&1 | tail -15
```

Fix any keyword or syntax errors.

---

## STEP 5 — Run Tests (if --run or --heal)

```bash
robot \
  --outputdir reports/robot \
  --log log.html \
  --report report.html \
  tests/robot/generated/<feature-slug>.robot \
  2>&1 | tail -20
```

For combined UI + API:
```bash
robot --outputdir reports/robot tests/robot/generated/<feature-slug>.robot tests/robot/generated/<feature-slug>-api.robot
```

Print results:
```
🤖 Robot Framework (ui+api) — secure-bank-login
   Tests:   12
   Passed:  10 ✅
   Failed:   2 ❌
```

---

## STEP 6 — Heal Failures (if --heal)

For each failure:

1. **Classify:**
   - `ElementNotFoundException` / `No keyword with name` → locator or keyword typo
   - `Timeout` → element load too slow
   - `AssertionError` → wrong expected value or real bug
   - `Connection refused` → app not running

2. **Auto-fix locator issues:** Try fallback locators (`id=`, `name=`, `xpath=`, `css=`). Update the `.robot` file.

3. **Auto-fix timing:** Increase `timeout` parameter on `Wait Until Element Is Visible`.

4. **Flag real bugs** with `[Tags]    known-bug` and a `[Documentation]` note.

Re-run with `--rerunfailed` flag:
```bash
robot --rerunfailed reports/robot/output.xml --outputdir reports/robot/rerun tests/robot/generated/<feature-slug>.robot
```

---

## STEP 7 — Final Summary

```
╔══════════════════════════════════════════════════════╗
║      swayambhu-qa — Robot Framework Complete         ║
╠══════════════════════════════════════════════════════╣
║  Suite    tests/robot/generated/<slug>.robot         ║
║  Mode     <ui|api|android|ios|ui+api|...>            ║
║  Tests    <total>                                    ║
╠══════════════════════════════════════════════════════╣
║  Passed   <n> ✅                                     ║
║  Failed   <n> ❌  (<n> healed, <n> real bugs)        ║
║  Report   reports/robot/report.html                  ║
╚══════════════════════════════════════════════════════╝
```
