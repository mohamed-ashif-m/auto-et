
package com.autoet.expensetracker;

import androidx.annotation.NonNull;
import androidx.room.Entity;
import androidx.room.Index;
import androidx.room.PrimaryKey;

@Entity(
        tableName = "categories",
        indices = {
                @Index(value = {"name"}, unique = true)
        }
)
public class Category {

    @PrimaryKey(autoGenerate = true)
    public int id;

    @NonNull
    public String name = "";

    // Stable key of the icon rendered by the app, e.g. "ShoppingBag".
    @NonNull
    public String icon = "Tag";

    // Seeded categories cannot be deleted.
    public boolean isDefault;

    // Controls the display order of the category pickers.
    public int sortOrder;
}
