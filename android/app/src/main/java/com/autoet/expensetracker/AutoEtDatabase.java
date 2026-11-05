
package com.autoet.expensetracker;

import android.content.Context;
import androidx.room.migration.Migration;
import androidx.sqlite.db.SupportSQLiteDatabase;
import androidx.room.Database;
import androidx.room.Room;
import androidx.room.RoomDatabase;

import net.zetetic.database.sqlcipher.SupportOpenHelperFactory;

@Database(
        entities = {Transaction.class},
        version = 2,
        exportSchema = false
)
public abstract class AutoEtDatabase extends RoomDatabase {

    private static volatile AutoEtDatabase INSTANCE;

    public abstract TransactionDao transactionDao();

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
.addMigrations(MIGRATION_1_2)
.build();
                }
            }
        }

        return INSTANCE;
    }
}
