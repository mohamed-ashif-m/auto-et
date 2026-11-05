package com.autoet.expensetracker;

import android.content.Context;
import android.database.Cursor;
import androidx.room.migration.Migration;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

import net.zetetic.database.sqlcipher.SupportOpenHelperFactory;

import java.util.HashSet;
import java.util.Set;

@Database(
        entities = {Transaction.class, KvEntry.class},
        version = 4,
        exportSchema = false
)
public abstract class AutoEtDatabase extends RoomDatabase {

    private static volatile AutoEtDatabase INSTANCE;

    public abstract TransactionDao transactionDao();

    public abstract KvDao kvDao();

    private static final Migration MIGRATION_1_2 =
        new Migration(1, 2) {
            @Override
            public void migrate(
                    SupportSQLiteDatabase database) {

                database.execSQL(
                    "ALTER TABLE transactions " +
                    "ADD COLUMN category TEXT NOT NULL DEFAULT 'Other'"
                );

                // Existing notification transactions become Online Payment.
                database.execSQL(
                    "UPDATE transactions SET category = 'Online Payment' " +
                    "WHERE sourcePackage IS NOT NULL " +
                    "AND sourcePackage != 'manual'"
                );
            }
        };

    // v3: optional note on each transaction + key/value store for settings.
    private static final Migration MIGRATION_2_3 =
        new Migration(2, 3) {
            @Override
            public void migrate(
                    SupportSQLiteDatabase database) {

                database.execSQL(
                    "ALTER TABLE transactions ADD COLUMN note TEXT"
                );

                database.execSQL(
                    "CREATE TABLE IF NOT EXISTS `kv_store` (" +
                    "`key` TEXT NOT NULL, " +
                    "`value` TEXT, " +
                    "PRIMARY KEY(`key`))"
                );
            }
        };

    // v4: self-healing rebuild. If a device already holds a version-3 file whose
    // layout differs from what Room expects (identity hash mismatch), this copies
    // every existing row into a correctly shaped table instead of failing.
    private static final Migration MIGRATION_3_4 =
        new Migration(3, 4) {
            @Override
            public void migrate(
                    SupportSQLiteDatabase database) {

                // Which columns does the current table really have?
                Set<String> existing = new HashSet<>();
                Cursor info = database.query(
                        "PRAGMA table_info(`transactions`)"
                );
                try {
                    int nameIndex = info.getColumnIndex("name");
                    while (info.moveToNext()) {
                        existing.add(info.getString(nameIndex));
                    }
                } finally {
                    info.close();
                }

                database.execSQL("DROP TABLE IF EXISTS `transactions_new`");

                database.execSQL(
                    "CREATE TABLE `transactions_new` (" +
                    "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                    "`amountPaise` INTEGER NOT NULL, " +
                    "`currency` TEXT, " +
                    "`merchant` TEXT, " +
                    "`type` TEXT, " +
                    "`sourcePackage` TEXT, " +
                    "`transactionTime` INTEGER NOT NULL, " +
                    "`dedupeKey` TEXT, " +
                    "`category` TEXT NOT NULL DEFAULT 'Other', " +
                    "`note` TEXT)"
                );

                // Copy only the columns that exist; NOT NULL ones get safe defaults.
                String[][] columns = {
                        {"id", "`id`"},
                        {"amountPaise", "COALESCE(`amountPaise`, 0)"},
                        {"currency", "`currency`"},
                        {"merchant", "`merchant`"},
                        {"type", "`type`"},
                        {"sourcePackage", "`sourcePackage`"},
                        {"transactionTime", "COALESCE(`transactionTime`, 0)"},
                        {"dedupeKey", "`dedupeKey`"},
                        {"category", "COALESCE(`category`, 'Other')"},
                        {"note", "`note`"},
                };

                StringBuilder target = new StringBuilder();
                StringBuilder source = new StringBuilder();

                for (String[] column : columns) {
                    if (!existing.contains(column[0])) continue;
                    if (target.length() > 0) {
                        target.append(", ");
                        source.append(", ");
                    }
                    target.append("`").append(column[0]).append("`");
                    source.append(column[1]);
                }

                if (target.length() > 0) {
                    database.execSQL(
                        "INSERT OR IGNORE INTO `transactions_new` (" + target + ") " +
                        "SELECT " + source + " FROM `transactions`"
                    );
                }

                database.execSQL("DROP TABLE `transactions`");
                database.execSQL(
                    "ALTER TABLE `transactions_new` RENAME TO `transactions`"
                );
                database.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS " +
                    "`index_transactions_dedupeKey` ON `transactions` (`dedupeKey`)"
                );

                // Settings table: recreate cleanly (it holds nothing irreplaceable).
                database.execSQL("DROP TABLE IF EXISTS `kv_store`");
                database.execSQL(
                    "CREATE TABLE IF NOT EXISTS `kv_store` (" +
                    "`key` TEXT NOT NULL, " +
                    "`value` TEXT, " +
                    "PRIMARY KEY(`key`))"
                );
            }
        };

    public static AutoEtDatabase getInstance(Context context)
            throws Exception {

        if (INSTANCE == null) {
            synchronized (AutoEtDatabase.class) {

                if (INSTANCE == null) {

                    // Load SQLCipher's native library.
                    System.loadLibrary("sqlcipher");

                    // Retrieve the protected database passphrase.
                    byte[] passphrase =
                            DatabaseKeyManager.getOrCreatePassphrase(context);

                    // Configure Room to use encrypted SQLite.
                    SupportOpenHelperFactory factory =
                            new SupportOpenHelperFactory(passphrase);

                    INSTANCE = Room.databaseBuilder(
                                    context.getApplicationContext(),
                                    AutoEtDatabase.class,
                                    "auto_et.db"
                            )
                            .openHelperFactory(factory)
                            .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4)
                            .build();
                }
            }
        }

        return INSTANCE;
    }
}