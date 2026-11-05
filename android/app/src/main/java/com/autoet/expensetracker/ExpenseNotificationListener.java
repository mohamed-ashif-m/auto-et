
package com.autoet.expensetracker;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ExpenseNotificationListener extends NotificationListenerService {

    private static final String TAG = "AutoEtNotifications";

    // Google Messages, Samsung Messages and the stock Android SMS apps.
    private static final Set<String> SMS_PACKAGES = new HashSet<>(Arrays.asList(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.android.mms",
            "com.android.messaging"
    ));

    private static final ExecutorService databaseExecutor =
            Executors.newSingleThreadExecutor();

    private static final Pattern AMOUNT_PATTERN =
            Pattern.compile("(?:Rs\\.?|INR|₹)\\s*([0-9,]+(?:\\.\\d{1,2})?)",
                    Pattern.CASE_INSENSITIVE);

    private static final String MERCHANT_END =
            "(?:\\s+(?:on|via|using|from|ref|upi|vpa|txn|a/c|using)\\b|[.,;]|$)";

    // Tried in order; the first one that matches wins.
    private static final Pattern[] MERCHANT_PATTERNS = {
            // "Paid to Swiggy", "Paid Rs.250 to Swiggy", "sent ₹40 to Ravi"
            Pattern.compile(
                    "(?:paid|sent|transferred)\\s+(?:(?:Rs\\.?|INR|₹)\\s*[0-9,.]+\\s+)?(?:to|at)\\s+(.+?)"
                            + MERCHANT_END,
                    Pattern.CASE_INSENSITIVE),
            // "debited ... to VPA swiggy@ybl", "spent ... at Big Bazaar"
            Pattern.compile(
                    "(?:debited|spent|purchase).*?\\b(?:at|to)\\s+(?:vpa\\s+)?(.+?)"
                            + MERCHANT_END,
                    Pattern.CASE_INSENSITIVE),
            // "credited ... from Ravi", "received Rs.500 from Mom"
            Pattern.compile(
                    "(?:received|credited|refund).*?\\bfrom\\s+(?:vpa\\s+)?(.+?)"
                            + MERCHANT_END,
                    Pattern.CASE_INSENSITIVE)
    };

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

        if (!SMS_PACKAGES.contains(packageName)) {
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

        final String content = contentBuilder.toString();
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

        // 1b. Ignore one-time-password messages ("OTP sent ...").
        if (normalized.contains("otp")
                && !normalized.contains("debited")
                && !normalized.contains("credited")) {

            Log.d(TAG, "OTP message ignored");
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

            final String finalMerchant = extractMerchant(content);
            final long finalAmount = amountPaise;
            final long transactionTime = sbn.getPostTime();

            // Fingerprint this notification to avoid inserting
            // the same notification callback more than once.
            final String dedupeKey = createDedupeKey(
                    packageName,
                    sbn.getKey(),
                    transactionTime,
                    content
            );

            databaseExecutor.execute(() -> {
                try {
                    AutoEtDatabase database =
                            AutoEtDatabase.getInstance(getApplicationContext());

                    Transaction transaction = new Transaction();

                    transaction.amountPaise = finalAmount;
                    transaction.currency = "INR";
                    transaction.merchant = finalMerchant;
                    transaction.type = detectedType;
                    transaction.category = CategoryRules.categorize(
                            database,
                            finalMerchant,
                            content,
                            "Online Payment"
                    );
                    transaction.sourcePackage = packageName;
                    transaction.transactionTime = transactionTime;
                    transaction.dedupeKey = dedupeKey;

                    long insertedId =
                            database.transactionDao().insert(transaction);

                    if (insertedId == -1) {
                        Log.d(TAG, "Duplicate notification ignored");
                    } else {
                        Log.d(TAG, "Transaction saved successfully");
                        Log.d(TAG, "Transaction ID: " + insertedId);
                        if ("EXPENSE".equals(detectedType)) {
                            BudgetAlerts.check(getApplicationContext(), database);
                        }
                    }

                } catch (Exception e) {
                    Log.e(TAG, "Database save failed", e);
                }
            });

        } catch (Exception e) {
            Log.e(TAG, "Transaction parsing failed", e);
        }
    }

    private String extractMerchant(String content) {
        for (Pattern pattern : MERCHANT_PATTERNS) {
            Matcher matcher = pattern.matcher(content);

            if (matcher.find()) {
                String candidate = matcher.group(1).trim();

                // Skip empty hits and hits that are really just an amount.
                if (candidate.length() >= 2
                        && !AMOUNT_PATTERN.matcher(candidate).find()) {

                    if (candidate.length() > 40) {
                        candidate = candidate.substring(0, 40).trim();
                    }

                    return candidate;
                }
            }
        }

        return "Unknown";
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
