
package com.autoet.expensetracker;

import androidx.sqlite.db.SupportSQLiteDatabase;

/**
 * Categories that ship with the app. They are inserted the first time the
 * database is opened (and re-inserted if they somehow went missing).
 *
 * The icon values are the names of the icons in the app's icon library.
 */
public final class DefaultCategories {

    private DefaultCategories() {
    }

    private static final String[][] CATEGORIES = {
            {"Online Payment", "CreditCard"},
            {"Cash", "Banknote"},
            {"Food & Dining", "Utensils"},
            {"Transport", "Car"},
            {"Shopping", "ShoppingBag"},
            {"Bills & Utilities", "ReceiptText"},
            {"Healthcare", "HeartPulse"},
            {"Entertainment", "Clapperboard"},
            {"Other", "Shapes"}
    };

    public static void seed(SupportSQLiteDatabase database) {
        for (int index = 0; index < CATEGORIES.length; index++) {
            database.execSQL(
                    "INSERT OR IGNORE INTO categories " +
                            "(name, icon, isDefault, sortOrder) " +
                            "VALUES (?, ?, 1, ?)",
                    new Object[]{
                            CATEGORIES[index][0],
                            CATEGORIES[index][1],
                            index
                    }
            );
        }
    }
}
