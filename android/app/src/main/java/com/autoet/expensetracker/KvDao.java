package com.autoet.expensetracker;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

@Dao
public interface KvDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    void put(KvEntry entry);

    @Query("SELECT * FROM kv_store WHERE `key` = :key LIMIT 1")
    KvEntry get(String key);
}
