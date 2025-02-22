package com.example.docsapp;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import com.google.gson.*;

@WebServlet("/GetAllUsersServlet")
public class GetAllUsersServlet extends HttpServlet {

    private static final String DB_URL = System.getProperty("DB_URL", System.getenv("DB_URL"));
    private static final String DB_USER = System.getProperty("DB_USER", System.getenv("DB_USER"));;
    private static final String DB_PASSWORD = System.getProperty("DB_PASSWORD", System.getenv("DB_PASSWORD"));;

    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
        response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setContentType("application/json");
        PrintWriter out = response.getWriter();

        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            String query = "SELECT email FROM users";
            try (PreparedStatement stmt = conn.prepareStatement(query)) {
                ResultSet rs = stmt.executeQuery();

                List<String> users = new ArrayList<>();
                while (rs.next()) {
                    users.add(rs.getString("email"));
                }

                JsonObject result = new JsonObject();
                result.addProperty("status", "success");
                JsonArray usersArray = new JsonArray();
                for (String user : users) {
                    usersArray.add(user);
                }
                result.add("users", usersArray);
                out.print(result.toString());
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonObject error = new JsonObject();
            error.addProperty("status", "error");
            error.addProperty("message", "Database error occurred.");
            out.print(error.toString());
        }
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
        response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setStatus(HttpServletResponse.SC_OK);
    }
}