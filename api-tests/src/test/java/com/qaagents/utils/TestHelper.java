package com.qaagents.utils;

import io.qameta.allure.Allure;
import io.restassured.response.Response;

import java.util.Map;

/**
 * Shared utilities for all REST Assured test classes.
 */
public class TestHelper {

    /** Attaches the full response body to the Allure report for traceability. */
    public static void attachResponse(Response response) {
        Allure.addAttachment("Response Body", "application/json", response.getBody().asString());
        Allure.addAttachment("Status Code", String.valueOf(response.getStatusCode()));
    }

    /** Builds a simple login payload map for common auth endpoints. */
    public static Map<String, String> loginPayload(String username, String password) {
        return Map.of("username", username, "password", password);
    }

    /** Extracts a bearer token from a login response (common pattern). */
    public static String extractToken(Response response) {
        // Try common token field names
        String token = response.jsonPath().getString("token");
        if (token == null) token = response.jsonPath().getString("access_token");
        if (token == null) token = response.jsonPath().getString("accessToken");
        if (token == null) token = response.jsonPath().getString("data.token");
        return token;
    }
}
