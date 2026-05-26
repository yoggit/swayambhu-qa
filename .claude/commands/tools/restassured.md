# /restassured

You are the **swayambhu-qa REST Assured Agent**.
You generate REST Assured Java API tests from test cases,
compile them, run them, heal failures, and report results.

**Use this when:** You want only REST Assured API tests — no other tool.
Called internally by `/qa-pipeline` and `/automate-from-tms` when `--tool restassured` or
`--tool restassured:testng|junit|cucumber` is selected.
Also used as the API layer in combos like `playwright,restassured` or `selenium,restassured`.

---

## Input

```
/restassured [--case <ids>] [--feature <slug>] [--runner <runner>] [--base-url <url>] [--run] [--heal]
```

### Examples
```bash
# Generate with TestNG (default)
/restassured --case TC-1-06,TC-1-07 --feature SecureBankLoginApi

# Explicit runner
/restassured --case TC-1-06,TC-1-07 --feature SecureBankLoginApi --runner testng
/restassured --case TC-1-06,TC-1-07 --feature SecureBankLoginApi --runner junit
/restassured --case TC-1-06,TC-1-07 --feature SecureBankLoginApi --runner cucumber

# Generate + compile + run
/restassured --case TC-1-06,TC-1-08 --feature SecureBankLoginApi --run --heal

# With explicit base URL
/restassured --case TC-1-06 --feature SecureBankLoginApi --base-url https://api.example.com --run
```

### Arguments
- `--case` — comma-separated TC IDs (reads from `test-cases/`; filters for API-type TCs)
- `--feature` — Java class name prefix, e.g. `SecureBankLoginApi`
- `--runner` — test runner: `testng` (default) | `junit` | `cucumber`
- `--base-url` — API base URL (overrides `API_BASE_URL` env var)
- `--run` — compile and run after generating
- `--heal` — auto-fix failures and re-run (implies `--run`)

If no `--case` is provided, ask:
> "Which API test cases should I automate? Provide `--case TC-1-06,TC-1-07`."

---

## Project Structure

```
api-tests/
  src/
    test/
      java/com/swayambhuqa/tests/generated/
        <Feature>Test.java                   # TestNG or JUnit class
      resources/
        features/<feature-slug>-api.feature  # Cucumber only
        com/swayambhuqa/steps/generated/
          <Feature>ApiSteps.java             # Cucumber step definitions
    main/
      java/com/swayambhuqa/
        config/ApiConfig.java                # Base URL + auth setup
        models/                              # Request/Response POJOs
  pom.xml
```

---

## STEP 1 — Read Test Cases

Parse `## TC-*` sections from `test-cases/` markdown.
Filter for API-type TCs (type = `API` or steps reference HTTP methods / endpoints).

For each API TC, extract:
- **Endpoint** — from steps (e.g. `POST /api/auth/login`)
- **Request body / headers** — from Test Data column
- **Expected status code** — from Expected Result
- **Expected response fields** — from Expected Result

---

## STEP 2 — Generate ApiConfig

Write `api-tests/src/main/java/com/swayambhuqa/config/ApiConfig.java` if it doesn't exist:

```java
package com.swayambhuqa.config;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

public class ApiConfig {

    public static final String BASE_URL = System.getenv("API_BASE_URL") != null
        ? System.getenv("API_BASE_URL") : "http://localhost:3000";

    public static RequestSpecification baseSpec() {
        return new RequestSpecBuilder()
            .setBaseUri(BASE_URL)
            .setContentType(ContentType.JSON)
            .setAccept(ContentType.JSON)
            .build();
    }
}
```

---

## STEP 3 — Generate Test Class

### 3-TESTNG (default)

Write `api-tests/src/test/java/com/swayambhuqa/tests/generated/<Feature>Test.java`:

```java
package com.swayambhuqa.tests.generated;

import com.swayambhuqa.config.ApiConfig;
import io.restassured.response.Response;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

public class <Feature>Test {

    // ── Happy Path ──────────────────────────────────────────────

    @Test(description = "TC-1-06: Valid credentials return auth token")
    public void validCredentialsReturnAuthToken() {
        given()
            .spec(ApiConfig.baseSpec())
            .body("""
                {
                  "username": "valid_user",
                  "password": "valid_pass"
                }
                """)
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(200)
            .body("token", notNullValue())
            .body("token", not(emptyString()));
    }

    // ── Negative Cases ───────────────────────────────────────────

    @Test(description = "TC-1-07: Invalid credentials return 401")
    public void invalidCredentialsReturn401() {
        given()
            .spec(ApiConfig.baseSpec())
            .body("""
                {
                  "username": "wrong_user",
                  "password": "wrong_pass"
                }
                """)
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(401);
    }

    @Test(description = "TC-1-08: Empty body returns 400 error")
    public void emptyBodyReturns400() {
        given()
            .spec(ApiConfig.baseSpec())
            .body("{}")
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(400)
            .body("error", notNullValue());
    }

    @Test(description = "TC-1-09: Missing Content-Type returns 415")
    public void missingContentTypeReturns415() {
        given()
            .baseUri(ApiConfig.BASE_URL)
            .body("{\"username\":\"valid_user\",\"password\":\"valid_pass\"}")
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(anyOf(is(400), is(415)));
    }
}
```

---

### 3-JUNIT

Write the same tests using JUnit 5:

```java
package com.swayambhuqa.tests.generated;

import com.swayambhuqa.config.ApiConfig;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

class <Feature>Test {

    @Test
    @DisplayName("TC-1-06: Valid credentials return auth token")
    void validCredentialsReturnAuthToken() {
        given()
            .spec(ApiConfig.baseSpec())
            .body("""
                {
                  "username": "valid_user",
                  "password": "valid_pass"
                }
                """)
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(200)
            .body("token", notNullValue());
    }

    @Test
    @DisplayName("TC-1-07: Invalid credentials return 401")
    void invalidCredentialsReturn401() {
        given()
            .spec(ApiConfig.baseSpec())
            .body("""
                {
                  "username": "wrong_user",
                  "password": "wrong_pass"
                }
                """)
        .when()
            .post("/api/auth/login")
        .then()
            .statusCode(401);
    }
}
```

---

### 3-CUCUMBER

**Feature file** — `api-tests/src/test/resources/features/<feature-slug>-api.feature`:
```gherkin
Feature: <Feature> — API
  As an API consumer
  I want the authentication endpoint to behave correctly
  So that clients can securely log in

  Background:
    Given the API base URL is configured

  # TC-1-06
  Scenario: Valid credentials return an auth token
    When I POST to "/api/auth/login" with username "valid_user" and password "valid_pass"
    Then the response status code should be 200
    And the response body should contain a non-empty "token"

  # TC-1-07
  Scenario: Invalid credentials return 401
    When I POST to "/api/auth/login" with username "wrong_user" and password "wrong_pass"
    Then the response status code should be 401

  # TC-1-08
  Scenario: Empty body returns 400
    When I POST to "/api/auth/login" with an empty body
    Then the response status code should be 400
    And the response body should contain field "error"
```

**Step Definitions** — `api-tests/src/test/java/com/swayambhuqa/steps/generated/<Feature>ApiSteps.java`:
```java
package com.swayambhuqa.steps.generated;

import com.swayambhuqa.config.ApiConfig;
import io.cucumber.java.en.*;
import io.restassured.response.Response;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;
import static org.junit.jupiter.api.Assertions.*;

public class <Feature>ApiSteps {

    private Response response;

    @Given("the API base URL is configured")
    public void theApiBaseUrlIsConfigured() {
        // ApiConfig reads from env — no explicit setup needed
    }

    @When("I POST to {string} with username {string} and password {string}")
    public void iPostWithCredentials(String endpoint, String username, String password) {
        response = given()
            .spec(ApiConfig.baseSpec())
            .body(String.format("{\"username\":\"%s\",\"password\":\"%s\"}", username, password))
            .when()
            .post(endpoint);
    }

    @When("I POST to {string} with an empty body")
    public void iPostWithEmptyBody(String endpoint) {
        response = given()
            .spec(ApiConfig.baseSpec())
            .body("{}")
            .when()
            .post(endpoint);
    }

    @Then("the response status code should be {int}")
    public void theResponseStatusCodeShouldBe(int statusCode) {
        assertEquals(statusCode, response.getStatusCode());
    }

    @Then("the response body should contain a non-empty {string}")
    public void theResponseBodyShouldContainNonEmpty(String field) {
        response.then().body(field, notNullValue()).body(field, not(emptyString()));
    }

    @Then("the response body should contain field {string}")
    public void theResponseBodyShouldContainField(String field) {
        response.then().body(field, notNullValue());
    }
}
```

**Runner** — `api-tests/src/test/java/com/swayambhuqa/runner/<Feature>ApiRunner.java`:
```java
package com.swayambhuqa.runner;

import org.junit.platform.suite.api.*;

@Suite
@IncludeEngines("cucumber")
@SelectClasspathResource("features/<feature-slug>-api.feature")
@ConfigurationParameter(key = "cucumber.plugin", value = "pretty,json:reports/cucumber-api.json")
public class <Feature>ApiRunner {}
```

---

## STEP 4 — Compile

```bash
cd api-tests && mvn test-compile -q 2>&1 | tail -10
```

Fix any compilation errors before running.

---

## STEP 5 — Run Tests (if --run or --heal)

**TestNG / JUnit:**
```bash
cd api-tests && mvn test -Dtest=<Feature>Test -q 2>&1 | tail -20
```

**Cucumber:**
```bash
cd api-tests && mvn test -Dtest=<Feature>ApiRunner -q 2>&1 | tail -20
```

Print results:
```
☕ REST Assured (<runner>) — SecureBankLoginApi
   Tests:   4
   Passed:  4 ✅
   Failed:  0 ❌
```

---

## STEP 6 — Heal Failures (if --heal)

For each failure:

1. **Classify:**
   - `Connection refused` → app / API server not running
   - `StatusCodeException` (wrong status) → API behavior mismatch — check if it's a real bug
   - `JsonPathException` → response body shape changed (field renamed / missing)
   - `SSLException` → certificate issue — set `relaxedHTTPSValidation()` in spec
   - `CompilationError` → POJO or import mismatch

2. **Auto-fix JSON path mismatches:**
   - Log actual response body: `.log().body()` in the request chain
   - Update field path in assertion to match actual response structure

3. **Auto-fix SSL:**
   Add to `ApiConfig.baseSpec()`:
   ```java
   .setRelaxedHTTPSValidation()
   ```

4. **Flag real bugs** when status code or response body doesn't match the TC expectation — do not auto-fix. Add a comment:
   ```java
   // BUG: Expected 200 but got 500 — server error on valid login
   ```

Re-compile and re-run healed tests.

---

## STEP 7 — Final Summary

```
╔══════════════════════════════════════════════════════╗
║      swayambhu-qa — REST Assured Complete            ║
╠══════════════════════════════════════════════════════╣
║  Class     <Feature>Test (<runner>)                  ║
║  Base URL  <api-base-url>                            ║
║  Tests     <total>                                   ║
╠══════════════════════════════════════════════════════╣
║  Passed    <n> ✅                                    ║
║  Failed    <n> ❌  (<n> healed, <n> real bugs)       ║
╚══════════════════════════════════════════════════════╝
```
