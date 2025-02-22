package com.example.docsapp;

import jakarta.servlet.ServletException;
import jakarta.servlet.annotation.WebServlet;
import jakarta.servlet.http.*;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import com.google.gson.*;

@WebServlet("/GetSharedDocumentsServlet")
public class GetSharedDocumentsServlet extends HttpServlet {

    private static final String DB_URL = System.getProperty("DB_URL", System.getenv("DB_URL"));
    private static final String DB_USER = System.getProperty("DB_USER", System.getenv("DB_USER"));;
    private static final String DB_PASSWORD = System.getProperty("DB_PASSWORD", System.getenv("DB_PASSWORD"));;

    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
        response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setContentType("application/json");
        PrintWriter out = response.getWriter();

        try {
            BufferedReader reader = request.getReader();
            JsonObject jsonObject = JsonParser.parseReader(reader).getAsJsonObject();
            String email = jsonObject.get("email").getAsString();

            try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {

                String userQuery = "SELECT id FROM users WHERE email = ?";
                try (PreparedStatement stmt = conn.prepareStatement(userQuery)) {
                    stmt.setString(1, email);
                    ResultSet rs = stmt.executeQuery();

                    if (rs.next()) {
                        int userId = rs.getInt("id");

                        String sharedQuery = "SELECT d.id, d.title, d.uniqueId " +
                                "FROM Documents d " +
                                "JOIN permissions p ON d.id = p.document_id " +
                                "WHERE p.user_id = ? AND (p.role = 'Viewer' OR p.role = 'Editor')";
                        try (PreparedStatement sharedStmt = conn.prepareStatement(sharedQuery)) {
                            sharedStmt.setInt(1, userId);
                            ResultSet sharedRs = sharedStmt.executeQuery();

                            List<JsonObject> documents = new ArrayList<>();
                            while (sharedRs.next()) {
                                JsonObject doc = new JsonObject();
                                doc.addProperty("id", sharedRs.getInt("id"));
                                doc.addProperty("title", sharedRs.getString("title"));
                                doc.addProperty("uniqueId", sharedRs.getString("uniqueId"));
                                documents.add(doc);
                            }

                            JsonObject result = new JsonObject();
                            result.addProperty("status", "success");
                            result.add("documents", new Gson().toJsonTree(documents));
                            out.print(result);
                            return;
                        }
                    }
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
            JsonObject error = new JsonObject();
            error.addProperty("status", "error");
            error.addProperty("message", "Database error occurred.");
            out.print(error);
        }
    }

    @Override
    protected void doOptions(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
        response.setHeader("Access-Control-Allow-Origin", "http://localhost:4200");
        response.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
        response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
        response.setHeader("Access-Control-Allow-Credentials", "true");
        response.setStatus(HttpServletResponse.SC_OK);
    }
}