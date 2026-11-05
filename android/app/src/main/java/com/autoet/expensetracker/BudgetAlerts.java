package com.autoet.expensetracker;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import org.json.JSONObject;

import java.util.Calendar;
import java.util.Locale;

/**
 * Posts a local notification when the remaining monthly budget drops below 10%
 * (and again if the budget is exceeded). Runs natively so it also works when the
 * app is closed and an SMS payment is detected. Must be called off the main thread.
 */
public final class BudgetAlerts {

    private static final String TAG = "AutoEtBudget";
    private static final String CHANNEL_ID = "budget_alerts";
    private static final int NOTIFICATION_ID = 4101;
    private static final String STATE_KEY = "budgetAlertState";

    private BudgetAlerts() {}

    public static void check(Context context, AutoEtDatabase db) {
        try {
            KvEntry settingsEntry = db.kvDao().get("settings");
            if (settingsEntry == null || settingsEntry.value == null) return;

            JSONObject settings = new JSONObject(settingsEntry.value);
            long budget = Math.round(settings.optDouble("monthlyBudget", 0));
            boolean enabled = settings.optBoolean("budgetAlerts", true);
            int startDay = Math.max(1, Math.min(28, settings.optInt("startDay", 1)));

            long[] range = cycleRange(startDay);
            String cycle = String.valueOf(range[0]);

            if (!enabled || budget <= 0) {
                saveState(db, cycle, 0);
                return;
            }

            Long spentBoxed = db.transactionDao().getExpensesBetween(range[0], range[1]);
            long spent = spentBoxed == null ? 0 : spentBoxed;
            long left = budget - spent;

            int level = 0;
            if (left < 0) level = 2;
            else if (left * 10 < budget) level = 1;

            int previous = 0;
            KvEntry state = db.kvDao().get(STATE_KEY);
            if (state != null && state.value != null && state.value.startsWith(cycle + ":")) {
                try {
                    previous = Integer.parseInt(state.value.substring(cycle.length() + 1));
                } catch (NumberFormatException ignored) {}
            }

            // Only notify when moving to a worse level; remember lower levels so a
            // raised budget can alert again later in the same cycle.
            if (level > previous) {
                notifyUser(context, level, left, budget);
            }
            if (level != previous) saveState(db, cycle, level);

        } catch (Exception e) {
            Log.e(TAG, "Budget check failed", e);
        }
    }

    private static void saveState(AutoEtDatabase db, String cycle, int level) {
        String value = cycle + ":" + level;
        KvEntry current = db.kvDao().get(STATE_KEY);
        if (current != null && value.equals(current.value)) return;
        KvEntry entry = new KvEntry();
        entry.key = STATE_KEY;
        entry.value = value;
        db.kvDao().put(entry);
    }

    private static void notifyUser(Context context, int level, long leftPaise, long budgetPaise) {
        if (Build.VERSION.SDK_INT >= 33
                && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Notification permission not granted");
            return;
        }

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID, "Budget alerts", NotificationManager.IMPORTANCE_HIGH);
            channel.setDescription("Reminders when your monthly budget is running low");
            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) manager.createNotificationChannel(channel);
        }

        String title;
        String text;
        if (level == 2) {
            title = "Monthly budget exceeded";
            text = "You're " + rupees(-leftPaise) + " over your " + rupees(budgetPaise) + " budget.";
        } else {
            int pct = (int) Math.max(0, (leftPaise * 100) / budgetPaise);
            title = "Budget running low";
            text = "Only " + rupees(leftPaise) + " left (" + pct + "% of " + rupees(budgetPaise) + ") this month.";
        }

        Intent open = new Intent(context, MainActivity.class)
                .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pending = PendingIntent.getActivity(
                context, 0, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .setContentIntent(pending);

        NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, builder.build());
    }

    private static String rupees(long paise) {
        long rupees = Math.round(paise / 100.0);
        return "₹" + String.format(Locale.US, "%,d", rupees);
    }

    /** [start, end) of the current budget cycle; mirrors cycleStart() in lib/period.ts. */
    private static long[] cycleRange(int startDay) {
        Calendar start = Calendar.getInstance();
        if (start.get(Calendar.DAY_OF_MONTH) < startDay) start.add(Calendar.MONTH, -1);
        start.set(Calendar.DAY_OF_MONTH, startDay);
        start.set(Calendar.HOUR_OF_DAY, 0);
        start.set(Calendar.MINUTE, 0);
        start.set(Calendar.SECOND, 0);
        start.set(Calendar.MILLISECOND, 0);
        Calendar end = (Calendar) start.clone();
        end.add(Calendar.MONTH, 1);
        return new long[] { start.getTimeInMillis(), end.getTimeInMillis() };
    }
}
