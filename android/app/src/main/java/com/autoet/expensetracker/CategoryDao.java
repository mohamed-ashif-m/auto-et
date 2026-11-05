
package com.autoet.expensetracker;

import androidx.room.Dao;
import androidx.room.Insert;
import androidx.room.OnConflictStrategy;
import androidx.room.Query;

import java.util.List;

@Dao
public interface CategoryDao {

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    long insert(Category category);

    @Query("SELECT * FROM categories ORDER BY sortOrder ASC, name COLLATE NOCASE ASC")
    List<Category> getAllCategories();

    @Query("SELECT * FROM categories WHERE id = :id LIMIT 1")
    Category findById(int id);

    @Query("SELECT * FROM categories WHERE LOWER(name) = LOWER(:name) LIMIT 1")
    Category findByNameIgnoreCase(String name);

    @Query("SELECT COUNT(*) FROM categories WHERE LOWER(name) = LOWER(:name)")
    int countByNameIgnoreCase(String name);

    @Query("SELECT COALESCE(MAX(sortOrder), -1) + 1 FROM categories")
    int getNextSortOrder();

    @Query("DELETE FROM categories WHERE id = :id AND isDefault = 0")
    int deleteCustomCategory(int id);

    @Query("SELECT COUNT(*) FROM categories")
    int count();
}
