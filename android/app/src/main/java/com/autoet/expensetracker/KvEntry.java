package com.autoet.expensetracker;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.PrimaryKey;

/**
 * Tiny key/value table stored inside the same encrypted database.
 * Used for app settings (theme, budgets, categories) and SMS rules, so the
 * notification listener can read the user's custom rules natively.
 */
@Entity(tableName = "kv_store")
public class KvEntry {

    @PrimaryKey
    @NonNull
    public String key = "";

    public String value;
}
