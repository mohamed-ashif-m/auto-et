
package com.autoet.expensetracker;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ExpenseNotificationListener extends NotificationListenerService {

    private static final String TAG = "AutoEtNotifications";

    private static final String SMS_PACKAGE =
        "com.google.android.apps.messaging";

    private static final ExecutorService databaseExecutor =
            Executors.newSingleThreadExecutor();

    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("(?:Rs\\.?|INR|₹)\\s*([0-9,]+(?:\\.\\d{1,2})?)",
                    Pattern.CASE_INSENSITIVE);
        @Override
public void onListenerConnected() {
    super.onListenerConnected();
    Log.d(TAG, "Auto Et notification listener CONNECTED");
}

@Override
public void onListenerDisconnected() {
    super.onListenerDisconnected();
    Log.d(TAG, "Auto Et notification listener DISCONNECTED");
}
    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        Log.d(TAG, "Notification callback received");
        
        String packageName = sbn.getPackageName();
        Log.d(TAG, "Notification package: " + packageName);
        
        if (!SMS_PACKAGE.equals(packageName)){
                
            return;
        }

        Notification notification = sbn.getNotification();
        Bundle extras = notification.extras;

        CharSequence title =
                extras.getCharSequence(Notification.EXTRA_TITLE);

        CharSequence text =
                extras.getCharSequence(Notification.EXTRA_TEXT);

        CharSequence bigText =
                extras.getCharSequence(Notification.EXTRA_BIG_TEXT);

        StringBuilder contentBuilder = new StringBuilder();

        if (title != null) contentBuilder.append(title).append(" ");
        if (text != null) contentBuilder.append(text).append(" ");
        if (bigText != null) contentBuilder.append(bigText);

        String content = contentBuilder.toString();
        String normalized = content.toLowerCase();

        // 1. Ignore unsuccessful or incomplete transactions.
if (normalized.contains("pending")
        || normalized.contains("processing")
        || normalized.contains("failed")
        || normalized.contains("declined")
        || normalized.contains("unsuccessful")
        || normalized.contains("initiated")) {

    Log.d(TAG, "Incomplete or unsuccessful transaction ignored");
    return;
}

// 2. Identify incoming payments and refunds.
boolean isIncome =
        normalized.contains("credited")
        || normalized.contains("received")
        || normalized.contains("refund")
        || normalized.contains("cashback");

// 3. Identify outgoing payments.
boolean isExpense =
        normalized.contains("debited")
        || normalized.contains("debit")
        || normalized.contains("paid")
        || normalized.contains("sent")
        || normalized.contains("purchase");

// 4. Ignore ambiguous notifications.
if (isIncome == isExpense) {
    Log.d(TAG, "Unrecognized or ambiguous transaction ignored");
    return;
}

final String detectedType = isIncome ? "INCOME" : "EXPENSE";

        Matcher amountMatcher = AMOUNT_PATTERN.matcher(content);

        if (!amountMatcher.find()) {
            Log.d(TAG, "No transaction amount found");
            return;
        }

        try {
            // Convert rupees to paise.
            long amountPaise = Math.round(
                    Double.parseDouble(
                            amountMatcher.group(1).replace(",", "")
                    ) * 100
            );

            if (amountPaise <= 0) return;

            String merchant = "Unknown";

            Pattern merchantPattern = Pattern.compile(
                    "paid\\s+to\\s+(.+?)(?:[.,]|$)",
                    Pattern.CASE_INSENSITIVE
            );

            Matcher merchantMatcher = merchantPattern.matcher(content);

            if (merchantMatcher.find()) {
                merchant = merchantMatcher.group(1).trim();
            }

            final String finalMerchant = merchant;
            final long finalAmount = amountPaise;
            final long transactionTime = sbn.getPostTime();

            // Fingerprint this notification to avoid inserting
            // the same notification callback more than once.
            String dedupeKey = createDedupeKey(
                    packageName,
                    sbn.getKey(),
                    transactionTime,
                    content
            );

            databaseExecutor.execute(() -> {
                try {
                    Transaction transaction = new Transaction();

                    transaction.amountPaise = finalAmount;
                    transaction.currency = "INR";
                    transaction.merchant = finalMerchant;
                    transaction.type = detectedType;
                    transaction.category = "Online Payment";
                    transaction.sourcePackage = packageName;
                    transaction.transactionTime = transactionTime;
                    transaction.dedupeKey = dedupeKey;

                    AutoEtDatabase database =
                            AutoEtDatabase.getInstance(getApplicationContext());

                    long insertedId =
                            database.transactionDao().insert(transaction);
                    Transaction savedTransaction =
                            database.transactionDao().findByDedupeKey(dedupeKey);

                    
                    if (insertedId == -1) {
                        Log.d(TAG, "Duplicate notification ignored");
                    } else {
                        Log.d(TAG, "Transaction saved successfully");
                        Log.d(TAG, "Transaction ID: " + insertedId);
                    }

                } catch (Exception e) {
                    Log.e(TAG, "Database save failed", e);
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Transaction parsing failed", e);
        }
    }

    private String createDedupeKey(
            String packageName,
            String notificationKey,
            long postTime,
            String content
    ) throws Exception {

        String input = packageName + "|"
                + notificationKey + "|"
                + postTime + "|"
                + content;

        MessageDigest digest = MessageDigest.getInstance("SHA-256");

        byte[] hash = digest.digest(
                input.getBytes(StandardCharsets.UTF_8)
        );

        StringBuilder result = new StringBuilder();

        for (byte b : hash) {
            result.append(String.format("%02x", b));
        }

        return result.toString();
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // No transaction processing required.
    }
}
