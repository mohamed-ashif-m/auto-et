
package com.autoet.expensetracker;

import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;
import androidx.annotation.NonNull;
import androidx.room.ColumnInfo;


@Entity(
        tableName = "transactions",
        indices = {
                @Index(value = {"dedupeKey"}, unique = true)
        }
)
public class Transaction {

    @PrimaryKey(autoGenerate = true)
    public int id;

    // Store ₹250.50 as 25050 paise
    public long amountPaise;

    public String currency = "INR";

    public String merchant;

    // EXPENSE or INCOME
    public String type;

    // Example: com.google.android.apps.nbu.paisa.user
    public String sourcePackage;

    // Original notification posting time
    public long transactionTime;

    // Used to prevent duplicate transactions
    public String dedupeKey;

    // Transaction category
@NonNull
@ColumnInfo(defaultValue = "'Other'")
public String category = "Other";
}
