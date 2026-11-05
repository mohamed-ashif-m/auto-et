
package com.autoet.expensetracker;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "TransactionPlugin")
public class TransactionPlugin extends Plugin {

    private static final ExecutorService databaseExecutor =
            Executors.newSingleThreadExecutor();

    @PluginMethod
    public void addTransaction(PluginCall call) {

        Double amountValue = call.getDouble("amountPaise");

        Long amountPaise = amountValue == null
                ? null
                : Math.round(amountValue);

        String merchant = call.getString("merchant");
        String type = call.getString("type");
        String category = call.getString("category");

        if (amountPaise == null || amountPaise <= 0) {
            call.reject("Enter a valid transaction amount");
            return;
        }

        if (merchant == null || merchant.trim().isEmpty()) {
            call.reject("Enter a merchant or description");
            return;
        }

        if (!"EXPENSE".equals(type) && !"INCOME".equals(type)) {
            call.reject("Invalid transaction type");
            return;
        }

        if (category == null || category.trim().isEmpty()) {
            category = "Other";
        }

        String[] allowedCategories = {
                "Online Payment",
                "Cash",
                "Food & Dining",
                "Transport",
                "Shopping",
                "Bills & Utilities",
                "Healthcare",
                "Entertainment",
                "Other"
        };

        boolean validCategory = false;

        for (String allowed : allowedCategories) {
            if (allowed.equals(category)) {
                validCategory = true;
                break;
            }
        }

        if (!validCategory) {
            call.reject("Invalid category");
            return;
        }

        final String selectedCategory = category;

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                Transaction transaction = new Transaction();

                transaction.amountPaise = amountPaise;
                transaction.currency = "INR";
                transaction.merchant = merchant.trim();
                transaction.type = type;
                transaction.category = selectedCategory;
                transaction.sourcePackage = "manual";
                transaction.transactionTime =
                        System.currentTimeMillis();
                transaction.dedupeKey =
                        "manual:" + UUID.randomUUID();

                long insertedId =
                        database.transactionDao().insert(transaction);

                if (insertedId == -1) {
                    call.reject("Could not save transaction");
                    return;
                }

                JSObject response = new JSObject();
                response.put("id", insertedId);
                response.put("category", selectedCategory);

                call.resolve(response);

            } catch (Exception e) {
                call.reject("Failed to save transaction", e);
            }
        });
    }

    @PluginMethod
    public void getTransactions(PluginCall call) {

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                List<Transaction> transactions =
                        database.transactionDao().getAllTransactions();

                JSArray resultArray = new JSArray();

                for (Transaction transaction : transactions) {
                    JSObject item = new JSObject();

                    item.put("id", transaction.id);
                    item.put("amountPaise", transaction.amountPaise);
                    item.put("currency", transaction.currency);
                    item.put("merchant", transaction.merchant);
                    item.put("type", transaction.type);
                    item.put("category", transaction.category);
                    item.put("transactionTime", transaction.transactionTime);
                    item.put("sourcePackage", transaction.sourcePackage);

                    resultArray.put(item);
                }

                JSObject response = new JSObject();
                response.put("transactions", resultArray);

                call.resolve(response);

            } catch (Exception e) {
                android.util.Log.e(
                        "AutoEtPlugin",
                        "Failed to load transactions",
                        e
                );

                call.reject(
                        "Failed to load transactions: " + e.getMessage(),
                        e
                );
            }
        });
    }
    
@PluginMethod
public void updateCategory(PluginCall call) {

    Integer transactionId = call.getInt("transactionId");
    String category = call.getString("category");

    if (transactionId == null || transactionId <= 0) {
        call.reject("Invalid transaction ID");
        return;
    }

    String[] allowedCategories = {
            "Online Payment",
            "Cash",
            "Food & Dining",
            "Transport",
            "Shopping",
            "Bills & Utilities",
            "Healthcare",
            "Entertainment",
            "Other"
    };

    boolean validCategory = false;

    if (category != null) {
        for (String allowed : allowedCategories) {
            if (allowed.equals(category)) {
                validCategory = true;
                break;
            }
        }
    }

    if (!validCategory) {
        call.reject("Invalid category");
        return;
    }

    databaseExecutor.execute(() -> {
        try {
            AutoEtDatabase database =
                    AutoEtDatabase.getInstance(getContext());

            int updatedRows =
                    database.transactionDao().updateCategory(
                            transactionId,
                            category
                    );

            if (updatedRows == 0) {
                call.reject("Transaction not found");
                return;
            }

            JSObject response = new JSObject();
            response.put("success", true);
            response.put("transactionId", transactionId);
            response.put("category", category);

            call.resolve(response);

        } catch (Exception e) {
            android.util.Log.e(
                    "AutoEtPlugin",
                    "Failed to update category",
                    e
            );

            call.reject("Failed to update category", e);
        }
    });
}

}
