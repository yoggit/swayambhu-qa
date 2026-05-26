package com.qaagents.tests.generated;

import com.qaagents.config.ApiConfig;
import com.qaagents.utils.TestHelper;
import io.qameta.allure.*;
import io.restassured.response.Response;
import org.testng.annotations.Test;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.*;

@Epic("Issue #1")
@Feature("User Login — Secure Bank")
public class SecureBankLoginApiTest {

    // TC-1-09: POST /api/login returns auth token
    @Test
    @Story("User can log in with valid credentials")
    @Severity(SeverityLevel.CRITICAL)
    @Description("POST /api/login with valid admin credentials should return HTTP 200 and an auth token")
    public void validAdminLoginReturnsToken() {
        Response response = given()
            .spec(ApiConfig.spec())
            .contentType("application/json")
            .body(TestHelper.loginPayload("admin", "admin123"))
            .when()
            .post("/api/login")
            .then()
            .statusCode(200)
            .body("token", notNullValue())
            .extract().response();

        TestHelper.attachResponse(response);
    }

    @Test
    @Story("Invalid credentials are rejected")
    @Severity(SeverityLevel.CRITICAL)
    @Description("POST /api/login with wrong password should return HTTP 401")
    public void invalidCredentialsReturns401() {
        Response response = given()
            .spec(ApiConfig.spec())
            .contentType("application/json")
            .body(TestHelper.loginPayload("admin", "wrongpass"))
            .when()
            .post("/api/login")
            .then()
            .statusCode(anyOf(equalTo(401), equalTo(400)))
            .extract().response();

        TestHelper.attachResponse(response);
    }

    @Test
    @Story("Login request requires a body")
    @Severity(SeverityLevel.NORMAL)
    @Description("POST /api/login with empty body should return 400 or 422")
    public void missingBodyReturnsError() {
        Response response = given()
            .spec(ApiConfig.spec())
            .contentType("application/json")
            .body("{}")
            .when()
            .post("/api/login")
            .then()
            .statusCode(anyOf(equalTo(400), equalTo(401), equalTo(422)))
            .extract().response();

        TestHelper.attachResponse(response);
    }
}
