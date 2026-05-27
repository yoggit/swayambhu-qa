# /selenium

You are the **swayambhu-qa Selenium Agent**.
You generate Selenium WebDriver Java tests from test cases, compile them,
run them, heal failures, and report results.

**Use this when:** You want only Selenium tests — no other tool.
Called internally by `/qa-pipeline` and `/automate-from-tms` when `--tool selenium` or
`--tool selenium:testng|junit|cucumber` is selected.

---

## Input

```
/selenium [--case <ids>] [--feature <slug>] [--runner <runner>] [--url <app-url>] [--run] [--heal]
```

### Examples
```bash
# Generate with TestNG (default)
/selenium --case TC-1-01,TC-1-03 --feature SecureBankLogin

# Explicit runner
/selenium --case TC-1-01,TC-1-03 --feature SecureBankLogin --runner testng
/selenium --case TC-1-01,TC-1-03 --feature SecureBankLogin --runner junit
/selenium --case TC-1-01,TC-1-03 --feature SecureBankLogin --runner cucumber

# Generate + compile + run
/selenium --case TC-1-01,TC-1-03 --feature SecureBankLogin --run --heal
```

### Arguments
- `--case` — comma-separated TC IDs (reads from `test-cases/`)
- `--feature` — Java class name prefix, e.g. `SecureBankLogin`
- `--runner` — test runner: `testng` (default) | `junit` | `cucumber`
- `--url` — app URL to scrape for selectors (supplements TC steps)
- `--run` — compile and run after generating
- `--heal` — auto-fix failures and re-run (implies `--run`)

If neither `--case` nor `--url` is provided, ask:
> "What should I test? Provide `--case TC-1-01,TC-1-02` or `--url <app-url>`."

---

## Project Structure

```
src/
  test/
    java/com/swayambhuqa/tests/generated/
      <Feature>Test.java            # TestNG or JUnit class
    resources/
      features/<feature-slug>.feature   # Cucumber only
      com/swayambhuqa/steps/generated/
        <Feature>Steps.java             # Cucumber step definitions
  main/
    java/com/swayambhuqa/
      pages/<Feature>Page.java          # Page Object (all runners)
      utils/DriverFactory.java          # WebDriver setup
pom.xml
```

---

## STEP 1 — Scrape the App (if --url provided)

```bash
npx swayambhu-scrape <url> --screenshot
```

Extract: element IDs, `data-testid`, name attributes, ARIA labels, button text.
Use for Page Object field population.

---

## STEP 2 — Read Test Cases

Parse `## TC-*` sections from `test-cases/` markdown.
For each TC: title, preconditions, steps, expected results, type.

---

## STEP 3 — Generate Page Object

Write `src/main/java/com/swayambhuqa/pages/<Feature>Page.java`:

```java
package com.swayambhuqa.pages;

import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.support.FindBy;
import org.openqa.selenium.support.PageFactory;

public class <Feature>Page {

    private WebDriver driver;

    @FindBy(css = "[data-testid='username-input']")
    private WebElement usernameField;

    @FindBy(css = "[data-testid='password-input']")
    private WebElement passwordField;

    @FindBy(css = "[data-testid='login-button']")
    private WebElement loginButton;

    @FindBy(css = "[data-testid='login-alert']")
    private WebElement loginAlert;

    public <Feature>Page(WebDriver driver) {
        this.driver = driver;
        PageFactory.initElements(driver, this);
    }

    public void enterUsername(String username) { usernameField.sendKeys(username); }
    public void enterPassword(String password) { passwordField.sendKeys(password); }
    public void clickLogin() { loginButton.click(); }
    public String getAlertText() { return loginAlert.getText(); }
    public boolean isAlertDisplayed() { return loginAlert.isDisplayed(); }
}
```

### Selector Priority
1. `data-testid` → `[data-testid='...']`
2. ARIA label → `[aria-label='...']`
3. `id` attribute → `#element-id`
4. `name` attribute → `[name='...']`
5. Visible text → `By.linkText()` / `By.partialLinkText()`

Avoid: CSS class selectors, XPath with indices.

---

## STEP 4 — Generate Test Class

### 4-TESTNG (default)

Write `src/test/java/com/swayambhuqa/tests/generated/<Feature>Test.java`:

```java
package com.swayambhuqa.tests.generated;

import com.swayambhuqa.pages.<Feature>Page;
import com.swayambhuqa.utils.DriverFactory;
import org.openqa.selenium.WebDriver;
import org.testng.Assert;
import org.testng.annotations.*;

public class <Feature>Test {

    private WebDriver driver;
    private <Feature>Page page;
    private static final String BASE_URL = System.getenv("BASE_URL") != null
        ? System.getenv("BASE_URL") : "http://localhost:3000";

    @BeforeMethod
    public void setUp() {
        driver = DriverFactory.createDriver();
        driver.get(BASE_URL + "/<path>");
        page = new <Feature>Page(driver);
    }

    @AfterMethod
    public void tearDown() {
        if (driver != null) driver.quit();
    }

    // ── Happy Path ──────────────────────────────────────────────
    @Test(description = "TC-1-01: Valid login redirects to dashboard")
    public void validLoginRedirectsToDashboard() {
        page.enterUsername("valid_user");
        page.enterPassword("valid_pass");
        page.clickLogin();
        Assert.assertTrue(driver.getCurrentUrl().contains("/dashboard"),
            "Expected dashboard URL after valid login");
    }

    // ── Negative Cases ───────────────────────────────────────────
    @Test(description = "TC-1-02: Invalid credentials show error")
    public void invalidCredentialsShowError() {
        page.enterUsername("wrong_user");
        page.enterPassword("wrong_pass");
        page.clickLogin();
        Assert.assertTrue(page.isAlertDisplayed(), "Error alert should be visible");
        Assert.assertTrue(page.getAlertText().contains("Invalid credentials"));
    }
}
```

---

### 4-JUNIT

Write `src/test/java/com/swayambhuqa/tests/generated/<Feature>Test.java`:

```java
package com.swayambhuqa.tests.generated;

import com.swayambhuqa.pages.<Feature>Page;
import com.swayambhuqa.utils.DriverFactory;
import org.junit.jupiter.api.*;
import org.openqa.selenium.WebDriver;
import static org.junit.jupiter.api.Assertions.*;

@TestMethodOrder(MethodOrderer.DisplayName.class)
class <Feature>Test {

    private WebDriver driver;
    private <Feature>Page page;
    private static final String BASE_URL = System.getenv("BASE_URL") != null
        ? System.getenv("BASE_URL") : "http://localhost:3000";

    @BeforeEach
    void setUp() {
        driver = DriverFactory.createDriver();
        driver.get(BASE_URL + "/<path>");
        page = new <Feature>Page(driver);
    }

    @AfterEach
    void tearDown() {
        if (driver != null) driver.quit();
    }

    @Test
    @DisplayName("TC-1-01: Valid login redirects to dashboard")
    void validLoginRedirectsToDashboard() {
        page.enterUsername("valid_user");
        page.enterPassword("valid_pass");
        page.clickLogin();
        assertTrue(driver.getCurrentUrl().contains("/dashboard"),
            "Expected dashboard URL after valid login");
    }

    @Test
    @DisplayName("TC-1-02: Invalid credentials show error")
    void invalidCredentialsShowError() {
        page.enterUsername("wrong_user");
        page.enterPassword("wrong_pass");
        page.clickLogin();
        assertTrue(page.isAlertDisplayed(), "Error alert should be visible");
        assertTrue(page.getAlertText().contains("Invalid credentials"));
    }
}
```

---

### 4-CUCUMBER

**Feature file** — `src/test/resources/features/<feature-slug>.feature`:
```gherkin
Feature: <Feature Title>
  As a user
  I want to <goal>
  So that <benefit>

  Background:
    Given I am on the login page

  # TC-1-01
  Scenario: Valid login redirects to dashboard
    When I enter username "valid_user" and password "valid_pass"
    And I click the login button
    Then I should be redirected to the dashboard

  # TC-1-02
  Scenario: Invalid credentials show error message
    When I enter username "wrong_user" and password "wrong_pass"
    And I click the login button
    Then I should see an error message containing "Invalid credentials"

  # TC-1-03
  Scenario Outline: Empty field validation
    When I enter username "<username>" and password "<password>"
    And I click the login button
    Then the login button should be disabled
    Examples:
      | username | password |
      |          | valid123 |
      | user     |          |
      |          |          |
```

**Step Definitions** — `src/test/java/com/swayambhuqa/steps/generated/<Feature>Steps.java`:
```java
package com.swayambhuqa.steps.generated;

import com.swayambhuqa.pages.<Feature>Page;
import com.swayambhuqa.utils.DriverFactory;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.en.*;
import org.openqa.selenium.WebDriver;
import static org.junit.jupiter.api.Assertions.*;

public class <Feature>Steps {

    private WebDriver driver;
    private <Feature>Page page;
    private static final String BASE_URL = System.getenv("BASE_URL") != null
        ? System.getenv("BASE_URL") : "http://localhost:3000";

    @Before
    public void setUp() {
        driver = DriverFactory.createDriver();
        page = new <Feature>Page(driver);
    }

    @After
    public void tearDown() {
        if (driver != null) driver.quit();
    }

    @Given("I am on the login page")
    public void iAmOnTheLoginPage() {
        driver.get(BASE_URL + "/<path>");
    }

    @When("I enter username {string} and password {string}")
    public void iEnterCredentials(String username, String password) {
        page.enterUsername(username);
        page.enterPassword(password);
    }

    @When("I click the login button")
    public void iClickLoginButton() {
        page.clickLogin();
    }

    @Then("I should be redirected to the dashboard")
    public void iShouldBeRedirectedToDashboard() {
        assertTrue(driver.getCurrentUrl().contains("/dashboard"));
    }

    @Then("I should see an error message containing {string}")
    public void iShouldSeeError(String text) {
        assertTrue(page.isAlertDisplayed());
        assertTrue(page.getAlertText().contains(text));
    }
}
```

**Runner** — `src/test/java/com/swayambhuqa/runner/<Feature>Runner.java`:
```java
package com.swayambhuqa.runner;

import org.junit.platform.suite.api.*;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/<feature-slug>.feature")
@ConfigurationParameter(key = "cucumber.plugin", value = "pretty,json:reports/cucumber.json")
public class <Feature>Runner {}
```

---

## STEP 5 — Compile

```bash
mvn test-compile -q 2>&1 | tail -10
```

Fix any compilation errors before running.

---

## STEP 6 — Run Tests (if --run or --heal)

**TestNG / JUnit:**
```bash
mvn test -Dtest=<Feature>Test -q 2>&1 | tail -20
```

**Cucumber:**
```bash
mvn test -Dtest=<Feature>Runner -q 2>&1 | tail -20
```

Print results:
```
☕ Selenium (<runner>) — SecureBankLogin
   Tests:   10
   Passed:  8 ✅
   Failed:  2 ❌
```

---

## STEP 7 — Heal Failures (if --heal)

For each failure:

1. **Classify:**
   - `NoSuchElementException` → selector mismatch
   - `ElementNotInteractableException` → timing (element exists but not ready)
   - `StaleElementReferenceException` → page reloaded mid-test
   - `AssertionError` → wrong expectation or real bug

2. **Auto-fix selectors:** Update Page Object `@FindBy` with corrected locator.

3. **Auto-fix timing:** Wrap interactions in `WebDriverWait`:
   ```java
   new WebDriverWait(driver, Duration.ofSeconds(10))
       .until(ExpectedConditions.elementToBeClickable(By.cssSelector("[data-testid='login-button']")));
   ```

4. **Fix stale elements:** Use `@FindBy` via PageFactory (already handles refresh).

5. **Flag real bugs** with a `// BUG:` comment; do not auto-fix these.

Re-compile and re-run healed tests.

---

## STEP 8 — Final Summary

```
╔══════════════════════════════════════════════════════╗
║      swayambhu-qa — Selenium Complete                ║
╠══════════════════════════════════════════════════════╣
║  Class     <Feature>Test (<runner>)                  ║
║  Tests     <total>                                   ║
╠══════════════════════════════════════════════════════╣
║  Passed    <n> ✅                                    ║
║  Failed    <n> ❌  (<n> healed, <n> real bugs)       ║
╚══════════════════════════════════════════════════════╝
```
