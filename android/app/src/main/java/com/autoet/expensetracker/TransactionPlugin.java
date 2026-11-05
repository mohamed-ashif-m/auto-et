
package com.autoet.expensetracker;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.FileProvider;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
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

    // ------------------------------------------------------------------
    // Validation helpers
    // ------------------------------------------------------------------

    // Categories are free text now (users can create their own).
    private static boolean isValidCategory(String category) {
        if (category == null) return false;
        String trimmed = category.trim();
        return !trimmed.isEmpty() && trimmed.length() <= 40;
    }
        // Capacitor's call.getDouble() returns null for whole numbers that don't fit
    // in an int (e.g. a timestamp in milliseconds), so read numbers from the raw
    // JSON instead; org.json converts Integer, Long and Double alike.
    private static Double readNumber(PluginCall call, String key) {
        JSObject data = call.getData();

        if (data == null || !data.has(key) || data.isNull(key)) {
            return null;
        }

        double value = data.optDouble(key, Double.NaN);

        return Double.isNaN(value) ? null : value;
    }

    private static String cleanNote(String note) {
        if (note == null) return null;
        String trimmed = note.trim();
        if (trimmed.isEmpty()) return null;
        return trimmed.length() > 200 ? trimmed.substring(0, 200) : trimmed;
    }

    private static JSObject toJs(Transaction transaction) {
        JSObject item = new JSObject();

        item.put("id", transaction.id);
        item.put("amountPaise", transaction.amountPaise);
        item.put("currency", transaction.currency);
        item.put("merchant", transaction.merchant);
        item.put("type", transaction.type);
        item.put("category", transaction.category);
        item.put("transactionTime", transaction.transactionTime);
        item.put("sourcePackage", transaction.sourcePackage);
        item.put("note", transaction.note);

        return item;
    }

    // ------------------------------------------------------------------
    // Transactions
    // ------------------------------------------------------------------

    @PluginMethod
    public void addTransaction(PluginCall call) {

        Double amountValue = readNumber(call, "amountPaise");

        Long amountPaise = amountValue == null
                ? null
                : Math.round(amountValue);

        String merchant = call.getString("merchant");
        String type = call.getString("type");
        String category = call.getString("category");
        String note = cleanNote(call.getString("note"));

        Double timeValue = readNumber(call, "transactionTime");

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

        if (!isValidCategory(category)) {
            call.reject("Invalid category");
            return;
        }

        final String selectedCategory = category.trim();
        final long transactionTime = timeValue == null
                ? System.currentTimeMillis()
                : Math.round(timeValue);

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
                transaction.note = note;
                transaction.sourcePackage = "manual";
                transaction.transactionTime = transactionTime;
                transaction.dedupeKey = "manual:" + UUID.randomUUID();

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
    public void updateTransaction(PluginCall call) {

        Integer transactionId = call.getInt("transactionId");
        Double amountValue = readNumber(call, "amountPaise");
        String merchant = call.getString("merchant");
        String type = call.getString("type");
        String category = call.getString("category");
        String note = cleanNote(call.getString("note"));
        Double timeValue = readNumber(call, "transactionTime");

        if (transactionId == null || transactionId <= 0) {
            call.reject("Invalid transaction ID");
            return;
        }

        if (amountValue == null || Math.round(amountValue) <= 0) {
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

        if (!isValidCategory(category)) {
            call.reject("Invalid category");
            return;
        }

        if (timeValue == null) {
            call.reject("Invalid date");
            return;
        }

        final long amountPaise = Math.round(amountValue);
        final long transactionTime = Math.round(timeValue);
        final String selectedCategory = category.trim();

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                int updatedRows = database.transactionDao().updateDetails(
                        transactionId,
                        merchant.trim(),
                        amountPaise,
                        type,
                        selectedCategory,
                        note,
                        transactionTime
                );

                if (updatedRows == 0) {
                    call.reject("Transaction not found");
                    return;
                }

                JSObject response = new JSObject();
                response.put("success", true);
                response.put("transactionId", transactionId);

                call.resolve(response);

            } catch (Exception e) {
                call.reject("Failed to update transaction", e);
            }
        });
    }

    @PluginMethod
    public void deleteTransaction(PluginCall call) {

        Integer transactionId = call.getInt("transactionId");

        if (transactionId == null || transactionId <= 0) {
            call.reject("Invalid transaction ID");
            return;
        }

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                int deleted =
                        database.transactionDao().deleteById(transactionId);

                if (deleted == 0) {
                    call.reject("Transaction not found");
                    return;
                }

                JSObject response = new JSObject();
                response.put("success", true);

                call.resolve(response);

            } catch (Exception e) {
                call.reject("Failed to delete transaction", e);
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
                    resultArray.put(toJs(transaction));
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

        if (!isValidCategory(category)) {
            call.reject("Invalid category");
            return;
        }

        final String selectedCategory = category.trim();

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                int updatedRows =
                        database.transactionDao().updateCategory(
                                transactionId,
                                selectedCategory
                        );

                if (updatedRows == 0) {
                    call.reject("Transaction not found");
                    return;
                }

                JSObject response = new JSObject();
                response.put("success", true);
                response.put("transactionId", transactionId);
                response.put("category", selectedCategory);

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

    // Moves every transaction from one category to another
    // (used when a custom category is deleted).
    @PluginMethod
    public void reassignCategory(PluginCall call) {

        String from = call.getString("from");
        String to = call.getString("to");

        if (!isValidCategory(from) || !isValidCategory(to)) {
            call.reject("Invalid category");
            return;
        }

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                int updatedRows =
                        database.transactionDao().reassignCategory(
                                from.trim(),
                                to.trim()
                        );

                JSObject response = new JSObject();
                response.put("updated", updatedRows);

                call.resolve(response);

            } catch (Exception e) {
                call.reject("Failed to reassign category", e);
            }
        });
    }

    @PluginMethod
    public void clearAllTransactions(PluginCall call) {

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                int deleted = database.transactionDao().deleteAll();

                JSObject response = new JSObject();
                response.put("deleted", deleted);

                call.resolve(response);

            } catch (Exception e) {
                call.reject("Failed to clear transactions", e);
            }
        });
    }

    // ------------------------------------------------------------------
    // Settings (key/value, stored in the same encrypted database)
    // ------------------------------------------------------------------

    @PluginMethod
    public void getValue(PluginCall call) {

        String key = call.getString("key");

        if (key == null || key.trim().isEmpty()) {
            call.reject("Missing key");
            return;
        }

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                KvEntry entry = database.kvDao().get(key);

                JSObject response = new JSObject();
                response.put("value", entry == null ? null : entry.value);

                call.resolve(response);

            } catch (Exception e) {
                call.reject("Failed to read setting", e);
            }
        });
    }

    @PluginMethod
    public void setValue(PluginCall call) {

        String key = call.getString("key");
        String value = call.getString("value");

        if (key == null || key.trim().isEmpty()) {
            call.reject("Missing key");
            return;
        }

        databaseExecutor.execute(() -> {
            try {
                AutoEtDatabase database =
                        AutoEtDatabase.getInstance(getContext());

                KvEntry entry = new KvEntry();
                entry.key = key;
                entry.value = value;

                database.kvDao().put(entry);

                call.resolve();

            } catch (Exception e) {
                call.reject("Failed to save setting", e);
            }
        });
    }

    // ------------------------------------------------------------------
    // SMS auto-tracking status
    // ------------------------------------------------------------------

    @PluginMethod
    public void isNotificationAccessEnabled(PluginCall call) {

        boolean enabled = NotificationManagerCompat
                .getEnabledListenerPackages(getContext())
                .contains(getContext().getPackageName());

        JSObject response = new JSObject();
        response.put("enabled", enabled);

        call.resolve(response);
    }

    @PluginMethod
    public void openNotificationAccessSettings(PluginCall call) {

        try {
            Intent intent = new Intent(
                    Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            getContext().startActivity(intent);
            call.resolve();

        } catch (Exception e) {
            call.reject("Could not open notification access settings", e);
        }
    }

    // ------------------------------------------------------------------
    // CSV export (writes to the app cache and opens the Android share sheet)
    // ------------------------------------------------------------------

    @PluginMethod
    public void exportCsv(PluginCall call) {

        String csv = call.getString("csv");
        String fileName = call.getString("fileName", "auto-et-export.csv");

        if (csv == null || csv.isEmpty()) {
            call.reject("Nothing to export");
            return;
        }

        final String safeName =
                fileName.replaceAll("[^A-Za-z0-9._-]", "_");

        databaseExecutor.execute(() -> {
            try {
                Context context = getContext();

                File directory = new File(context.getCacheDir(), "exports");

                if (!directory.exists() && !directory.mkdirs()) {
                    call.reject("Could not create export folder");
                    return;
                }

                File file = new File(directory, safeName);

                try (FileOutputStream stream = new FileOutputStream(file)) {
                    stream.write(csv.getBytes(StandardCharsets.UTF_8));
                }

                Uri uri = FileProvider.getUriForFile(
                        context,
                        context.getPackageName() + ".fileprovider",
                        file
                );

                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType("text/csv");
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser =
                        Intent.createChooser(send, "Export transactions");
                chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                context.startActivity(chooser);

                call.resolve();

            } catch (Exception e) {
                call.reject("Export failed", e);
            }
        });
    }
}
