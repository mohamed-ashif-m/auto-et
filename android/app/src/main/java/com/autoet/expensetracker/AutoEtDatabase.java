
package com.autoet.expensetracker;

import android.content.Context;

import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;
import androidx.room.migration.Migration;
import androidx.sqlite.db.SupportSQLiteDatabase;

import net.zetetic.database.sqlcipher.SupportOpenHelperFactory;

@Database(
        entities = {Transaction.class, Category.class},
        version = 3,
        exportSchema = false
)
public abstract class AutoEtDatabase extends RoomDatabase {

    private static volatile AutoEtDatabase INSTANCE;

    public abstract TransactionDao transactionDao();

    public abstract CategoryDao categoryDao();

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

    private static final Migration MIGRATION_2_3 =
        new Migration(2, 3) {
            @Override
            public void migrate(
                    SupportSQLiteDatabase database) {

                database.execSQL(
                    "CREATE TABLE IF NOT EXISTS `categories` (" +
                    "`id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, " +
                    "`name` TEXT NOT NULL, " +
                    "`icon` TEXT NOT NULL, " +
                    "`isDefault` INTEGER NOT NULL, " +
                    "`sortOrder` INTEGER NOT NULL)"
                );

                database.execSQL(
                    "CREATE UNIQUE INDEX IF NOT EXISTS " +
                    "`index_categories_name` ON `categories` (`name`)"
                );
            }
        };

    private static final RoomDatabase.Callback SEED_CATEGORIES =
        new RoomDatabase.Callback() {
            @Override
            public void onOpen(SupportSQLiteDatabase database) {
                super.onOpen(database);
                DefaultCategories.seed(database);
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
                           .addMigrations(MIGRATION_1_2, MIGRATION_2_3)
                           .addCallback(SEED_CATEGORIES)
                           .build();
                }
            }
        }

        return INSTANCE;
    }
}
