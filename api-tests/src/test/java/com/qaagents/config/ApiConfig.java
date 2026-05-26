package com.qaagents.config;

import io.restassured.RestAssured;
import io.restassured.builder.RequestSpecBuilder;
import io.restassured.filter.log.RequestLoggingFilter;
import io.restassured.filter.log.ResponseLoggingFilter;
import io.restassured.http.ContentType;
import io.restassured.specification.RequestSpecification;

/**
 * Central REST Assured configuration.
 * All generated test classes use ApiConfig.spec() as their base spec.
 * Base URL is read from BASE_URL env var, defaulting to localhost.
 */
public class ApiConfig {

    private static final String BASE_URL =
        System.getenv("BASE_URL") != null ? System.getenv("BASE_URL") : "http://localhost:3000";

    private static RequestSpecification spec;

    public static RequestSpecification spec() {
        if (spec == null) {
            RestAssured.baseURI = BASE_URL;
            spec = new RequestSpecBuilder()
                .setBaseUri(BASE_URL)
                .setContentType(ContentType.JSON)
                .setAccept(ContentType.JSON)
                .addFilter(new RequestLoggingFilter())
                .addFilter(new ResponseLoggingFilter())
                .build();
        }
        return spec;
    }

    public static String getBaseUrl() {
        return BASE_URL;
    }
}
