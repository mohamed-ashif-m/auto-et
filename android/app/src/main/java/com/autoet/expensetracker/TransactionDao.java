package com.autoet.expensetracker;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

@Dao
public interface TransactionDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insert(Transaction transaction);

    @Query("SELECT * FROM transactions ORDER BY transactionTime DESC")
    List<Transaction> getAllTransactions();

    @Query("SELECT * FROM transactions WHERE type = :type ORDER BY transactionTime DESC")
    List<Transaction> getTransactionsByType(String type);

    @Query("SELECT SUM(amountPaise) FROM transactions WHERE type = 'EXPENSE'")
    Long getTotalExpenses();

    @Query("SELECT SUM(amountPaise) FROM transactions WHERE type = 'INCOME'")
    Long getTotalIncome();

    @Query("SELECT * FROM transactions WHERE dedupeKey = :key LIMIT 1")
    Transaction findByDedupeKey(String key);

    @Query("UPDATE transactions SET category = :category WHERE id = :transactionId")
    int updateCategory(int transactionId, String category);

    @Query("UPDATE transactions SET merchant = :merchant, amountPaise = :amountPaise, "
            + "type = :type, category = :category, note = :note, "
            + "transactionTime = :transactionTime WHERE id = :transactionId")
    int updateDetails(int transactionId, String merchant, long amountPaise,
                      String type, String category, String note, long transactionTime);

    @Query("UPDATE transactions SET category = :toCategory WHERE category = :fromCategory")
    int reassignCategory(String fromCategory, String toCategory);

    @Query("DELETE FROM transactions WHERE id = :transactionId")
    int deleteById(int transactionId);

    @Query("DELETE FROM transactions")
    int deleteAll();
}
