
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

    private static final int MAX_CATEGORY_NAME_LENGTH = 40;

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

        final String selectedCategory = category.trim();

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                Category categoryRecord =
                        database.categoryDao()
                                .findByNameIgnoreCase(selectedCategory);

                if (categoryRecord == null) {
                    call.reject("Invalid category");
                    return;
                }

                Transaction transaction = new Transaction();

                transaction.amountPaise = amountPaise;
                transaction.currency = "INR";
                transaction.merchant = merchant.trim();
                transaction.type = type;
                transaction.category = categoryRecord.name;
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
                response.put("category", categoryRecord.name);

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

        if (category == null || category.trim().isEmpty()) {
            call.reject("Invalid category");
            return;
        }

        final String selectedCategory = category.trim();

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                Category categoryRecord =
                        database.categoryDao()
                                .findByNameIgnoreCase(selectedCategory);

                if (categoryRecord == null) {
                    call.reject("Invalid category");
                    return;
                }

                int updatedRows =
                        database.transactionDao().updateCategory(
                                transactionId,
                                categoryRecord.name
                        );

                if (updatedRows == 0) {
                    call.reject("Transaction not found");
                    return;
                }

                JSObject response = new JSObject();
                response.put("success", true);
                response.put("transactionId", transactionId);
                response.put("category", categoryRecord.name);

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

    @PluginMethod
    public void getCategories(PluginCall call) {

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                List<Category> categories =
                        database.categoryDao().getAllCategories();

                JSArray resultArray = new JSArray();

                for (Category category : categories) {
                    resultArray.put(toJsObject(category));
                }

                JSObject response = new JSObject();
                response.put("categories", resultArray);

                call.resolve(response);

            } catch (Exception e) {
                android.util.Log.e(
                        "AutoEtPlugin",
                        "Failed to load categories",
                        e
                );

                call.reject(
                        "Failed to load categories: " + e.getMessage(),
                        e
                );
            }
        });
    }

    @PluginMethod
    public void addCategory(PluginCall call) {

        String rawName = call.getString("name");
        String rawIcon = call.getString("icon");

        if (rawName == null || rawName.trim().isEmpty()) {
            call.reject("Enter a category name");
            return;
        }

        final String name = rawName.trim();

        if (name.length() > MAX_CATEGORY_NAME_LENGTH) {
            call.reject(
                    "Category name must be " +
                            MAX_CATEGORY_NAME_LENGTH +
                            " characters or fewer"
            );
            return;
        }

        final String icon =
                rawIcon == null || rawIcon.trim().isEmpty()
                        ? "Tag"
                        : rawIcon.trim();

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                CategoryDao categoryDao = database.categoryDao();

                if (categoryDao.countByNameIgnoreCase(name) > 0) {
                    call.reject(
                            "A category with this name already exists"
                    );
                    return;
                }

                Category category = new Category();
                category.name = name;
                category.icon = icon;
                category.isDefault = false;
                category.sortOrder = categoryDao.getNextSortOrder();

                long insertedId = categoryDao.insert(category);

                if (insertedId == -1) {
                    call.reject("Could not save category");
                    return;
                }

                category.id = (int) insertedId;

                call.resolve(toJsObject(category));

            } catch (Exception e) {
                android.util.Log.e(
                        "AutoEtPlugin",
                        "Failed to save category",
                        e
                );

                call.reject("Failed to save category", e);
            }
        });
    }

    @PluginMethod
    public void deleteCategory(PluginCall call) {

        Integer categoryId = call.getInt("id");

        if (categoryId == null || categoryId <= 0) {
            call.reject("Invalid category ID");
            return;
        }

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                CategoryDao categoryDao = database.categoryDao();

                Category category = categoryDao.findById(categoryId);

                if (category == null) {
                    call.reject("Category not found");
                    return;
                }

                if (category.isDefault) {
                    call.reject(
                            "Default categories cannot be deleted"
                    );
                    return;
                }

                // Keep the transaction history intact by moving the
                // transactions of this category to "Other".
                database.transactionDao().reassignCategory(
                        category.name,
                        "Other"
                );

                int deletedRows =
                        categoryDao.deleteCustomCategory(categoryId);

                if (deletedRows == 0) {
                    call.reject("Could not delete category");
                    return;
                }

                JSObject response = new JSObject();
                response.put("success", true);
                response.put("id", categoryId);

                call.resolve(response);

            } catch (Exception e) {
                android.util.Log.e(
                        "AutoEtPlugin",
                        "Failed to delete category",
                        e
                );

                call.reject("Failed to delete category", e);
            }
        });
    }

    private JSObject toJsObject(Category category) {
        JSObject item = new JSObject();

        item.put("id", category.id);
        item.put("name", category.name);
        item.put("icon", category.icon);
        item.put("isDefault", category.isDefault);
        item.put("sortOrder", category.sortOrder);

        return item;
    }
}
